/**
 * GET /api/security — reads openclaw.json and returns security health checks
 */
import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");

type CheckStatus = "ok" | "warn" | "fail" | "unknown";

interface SecurityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

export async function GET() {
  let config: Record<string, unknown> = {};
  let configLoaded = false;

  try {
    if (existsSync(CONFIG_PATH)) {
      config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      configLoaded = true;
    }
  } catch { /* use empty config */ }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = (obj: any, ...keys: string[]): unknown => {
    let cur = obj;
    for (const k of keys) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[k];
    }
    return cur;
  };

  const checks: SecurityCheck[] = [];

  // 1. Config file found
  checks.push({
    id: "config-found",
    label: "OpenClaw config readable",
    status: configLoaded ? "ok" : "fail",
    detail: configLoaded
      ? `Found at ${CONFIG_PATH}`
      : `Config not found at ${CONFIG_PATH} — OpenClaw may not be installed or configured`,
    fix: configLoaded ? undefined : "Install and run OpenClaw at least once to generate the config file",
  });

  if (!configLoaded) {
    return NextResponse.json({ checks, score: 0, configLoaded });
  }

  // 2. Auth enabled
  const authEnabled = get(config, "auth", "enabled");
  const hasPassword = !!(get(config, "auth", "password") || get(config, "auth", "secret"));
  checks.push({
    id: "auth-enabled",
    label: "Authentication enabled",
    status: authEnabled === false ? "fail" : authEnabled === true && hasPassword ? "ok" : "warn",
    detail: authEnabled === false
      ? "auth.enabled is false — anyone who can reach the gateway can send commands"
      : authEnabled === true && hasPassword
        ? "Authentication is enabled with a password"
        : "auth.enabled not explicitly set — default may vary by version",
    fix: authEnabled === false
      ? 'Set auth.enabled: true and a strong auth.password in openclaw.json'
      : undefined,
  });

  // 3. Gateway not bound to 0.0.0.0
  const gatewayHost = get(config, "gateway", "host")
    ?? get(config, "gateway", "bind")
    ?? get(config, "server", "host");
  checks.push({
    id: "gateway-binding",
    label: "Gateway not publicly exposed",
    status: gatewayHost == null ? "unknown"
      : String(gatewayHost) === "0.0.0.0" ? "fail"
      : String(gatewayHost).startsWith("127.") || String(gatewayHost) === "localhost" ? "ok"
      : "warn",
    detail: gatewayHost == null
      ? "Could not determine gateway binding — verify manually"
      : String(gatewayHost) === "0.0.0.0"
        ? `Gateway bound to 0.0.0.0 — accessible from any network interface`
        : `Gateway bound to ${gatewayHost}`,
    fix: String(gatewayHost) === "0.0.0.0"
      ? 'Change gateway.host to "127.0.0.1" in openclaw.json unless remote access is intentional'
      : undefined,
  });

  // 4. Exec tools restricted
  const execEnabled = get(config, "tools", "exec", "enabled")
    ?? get(config, "tools", "exec");
  checks.push({
    id: "exec-tools",
    label: "Exec tools restricted",
    status: execEnabled === false ? "ok"
      : execEnabled === true ? "warn"
      : "unknown",
    detail: execEnabled === false
      ? "Shell execution tools are disabled"
      : execEnabled === true
        ? "Shell execution tools are enabled — agents can run arbitrary commands"
        : "Could not determine exec tool status — check tools.exec in openclaw.json",
    fix: execEnabled === true
      ? "Consider setting tools.exec.enabled: false or restricting to specific commands if not needed"
      : undefined,
  });

  // 5. Number of agents configured
  const agentList = get(config, "agents", "list");
  const agentCount = Array.isArray(agentList) ? agentList.length : 0;
  checks.push({
    id: "agent-count",
    label: "Agent configuration",
    status: agentCount === 0 ? "warn" : "ok",
    detail: agentCount === 0
      ? "No agents configured in openclaw.json"
      : `${agentCount} agent${agentCount !== 1 ? "s" : ""} configured`,
  });

  // 6. TLS / HTTPS
  const tlsEnabled = get(config, "tls", "enabled")
    ?? get(config, "server", "tls")
    ?? get(config, "https");
  checks.push({
    id: "tls",
    label: "TLS / HTTPS",
    status: tlsEnabled === true ? "ok" : tlsEnabled === false ? "warn" : "unknown",
    detail: tlsEnabled === true
      ? "TLS is enabled"
      : tlsEnabled === false
        ? "TLS is disabled — traffic between clients and gateway is unencrypted"
        : "TLS configuration not found — HTTP only (acceptable for localhost use)",
    fix: tlsEnabled === false
      ? "Enable TLS if OpenClaw is accessible over a network"
      : undefined,
  });

  const score = Math.round(
    (checks.filter((c) => c.status === "ok").length / checks.length) * 100
  );

  return NextResponse.json({ checks, score, configLoaded });
}
