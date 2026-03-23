/**
 * GET /api/security — reads openclaw.json and returns security health checks
 *
 * Score formula: only "ok" and "warn" checks count toward the score.
 * "unknown" checks are informational and do not penalise the score.
 * Score = (ok * 1 + warn * 0.5) / (ok + warn + fail) * 100
 */
import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { requirePro } from "@/server/require-pro";
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
  const block = requirePro(); if (block) return block;
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
  // OpenClaw stores auth under gateway.auth.mode (token/none) or auth.enabled
  const gatewayAuthMode = get(config, "gateway", "auth", "mode") as string | undefined;
  const authEnabled     = get(config, "auth", "enabled");
  const hasPassword     = !!(get(config, "auth", "password") || get(config, "auth", "secret"));

  let authStatus: CheckStatus;
  let authDetail: string;
  let authFix: string | undefined;

  if (gatewayAuthMode && gatewayAuthMode !== "none" && gatewayAuthMode !== "off") {
    authStatus = "ok";
    authDetail = `Authentication enabled (mode: ${gatewayAuthMode})`;
  } else if (gatewayAuthMode === "none" || gatewayAuthMode === "off") {
    authStatus = "fail";
    authDetail = "Gateway auth is disabled — anyone who can reach the gateway can send commands";
    authFix = 'Set gateway.auth.mode to "token" in openclaw.json';
  } else if (authEnabled === true && hasPassword) {
    authStatus = "ok";
    authDetail = "Authentication is enabled with a password";
  } else if (authEnabled === false) {
    authStatus = "fail";
    authDetail = "auth.enabled is false — anyone who can reach the gateway can send commands";
    authFix = 'Set auth.enabled: true and a strong auth.password in openclaw.json';
  } else {
    authStatus = "warn";
    authDetail = "Auth configuration not explicitly found — verify gateway.auth in openclaw.json";
  }

  checks.push({ id: "auth-enabled", label: "Authentication enabled", status: authStatus, detail: authDetail, fix: authFix });

  // 3. Gateway not bound to 0.0.0.0
  const gatewayBind = get(config, "gateway", "bind")
    ?? get(config, "gateway", "host")
    ?? get(config, "server", "host");
  const gatewayMode = get(config, "gateway", "mode") as string | undefined;

  const bindStr = gatewayBind != null ? String(gatewayBind) : null;
  const isLoopback = bindStr != null && (
    bindStr === "loopback" ||
    bindStr.startsWith("127.") ||
    bindStr === "localhost" ||
    bindStr === "local"
  );
  const isPublic = bindStr === "0.0.0.0";
  // "local" mode implies loopback even if bind is not set
  const modeIsLocal = gatewayMode === "local" || gatewayMode === "loopback";

  checks.push({
    id: "gateway-binding",
    label: "Gateway not publicly exposed",
    status: isPublic ? "fail"
      : isLoopback || modeIsLocal ? "ok"
      : bindStr == null ? "unknown"
      : "warn",
    detail: isPublic
      ? "Gateway bound to 0.0.0.0 — accessible from any network interface"
      : isLoopback || modeIsLocal
        ? `Gateway restricted to loopback${bindStr ? ` (${bindStr})` : ""}`
        : bindStr == null
          ? "Could not determine gateway binding — verify manually"
          : `Gateway bound to ${bindStr}`,
    fix: isPublic
      ? 'Change gateway.bind to "loopback" in openclaw.json unless remote access is intentional'
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
        : "Exec tool config not found — defaults apply (check tools.exec in openclaw.json)",
    fix: execEnabled === true
      ? "Consider setting tools.exec.enabled: false or restricting to specific commands if not needed"
      : undefined,
  });

  // 5. Number of agents configured
  const agentList  = get(config, "agents", "list");
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
  // TLS is optional for localhost-only setups — don't penalise unknown
  checks.push({
    id: "tls",
    label: "TLS / HTTPS",
    status: tlsEnabled === true ? "ok" : tlsEnabled === false ? "warn" : "unknown",
    detail: tlsEnabled === true
      ? "TLS is enabled"
      : tlsEnabled === false
        ? "TLS is disabled — traffic between clients and gateway is unencrypted"
        : "TLS not configured — acceptable for localhost-only use",
    fix: tlsEnabled === false
      ? "Enable TLS if OpenClaw is accessible over a network"
      : undefined,
  });

  // Score: ok=full, warn=half, fail=zero, unknown=excluded from calculation
  const scorable = checks.filter((c) => c.status !== "unknown");
  const score = scorable.length === 0 ? 100 : Math.round(
    (scorable.filter((c) => c.status === "ok").length * 1 +
     scorable.filter((c) => c.status === "warn").length * 0.5) /
    scorable.length * 100
  );

  return NextResponse.json({ checks, score, configLoaded });
}
