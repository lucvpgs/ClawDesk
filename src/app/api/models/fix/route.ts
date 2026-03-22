/**
 * POST /api/models/fix
 * Applies automatic fixes for common model configuration problems.
 *
 * type = "ollama-daemon-env"
 *   Adds OLLAMA_API_KEY and OLLAMA_BASE_URL to the OpenClaw service environment
 *   (LaunchAgent plist on macOS, systemd unit on Linux) and restarts the service.
 */
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir, platform } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

const PLIST_PATH = path.join(homedir(), "Library", "LaunchAgents", "ai.openclaw.gateway.plist");

const SYSTEMD_PATHS = [
  path.join(homedir(), ".config", "systemd", "user", "openclaw-gateway.service"),
  "/etc/systemd/user/openclaw-gateway.service",
];

// ── Plist helpers ─────────────────────────────────────────────────────────────

function plistHasKey(plist: string, key: string): boolean {
  return plist.includes(`<key>${key}</key>`);
}

function plistSetKey(plist: string, key: string, value: string): string {
  if (plistHasKey(plist, key)) {
    // Replace existing value
    return plist.replace(
      new RegExp(`(<key>${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</key>\\s*<string>)[^<]*(</string>)`),
      `$1${value}$2`
    );
  }
  // Insert before the closing </dict> that ends EnvironmentVariables
  // Pattern: last    </dict> before   </dict> before </plist>
  return plist.replace(
    /([ \t]*<\/dict>\n)([ \t]*<\/dict>\n<\/plist>)/,
    `    <key>${key}</key>\n    <string>${value}</string>\n$1$2`
  );
}

// ── Fix handlers ──────────────────────────────────────────────────────────────

async function fixOllamaDaemonEnv(): Promise<{ ok: boolean; message: string; restarting?: boolean }> {
  const os = platform();

  if (os === "darwin") {
    // ── macOS: LaunchAgent plist ──────────────────────────────────────────────
    if (!existsSync(PLIST_PATH)) {
      return {
        ok: false,
        message:
          `LaunchAgent not found at ${PLIST_PATH}. ` +
          "Is OpenClaw installed as a service? Run: openclaw service install",
      };
    }

    let plist = readFileSync(PLIST_PATH, "utf-8");
    plist = plistSetKey(plist, "OLLAMA_API_KEY", "ollama-local");
    plist = plistSetKey(plist, "OLLAMA_BASE_URL", "http://localhost:11434");
    writeFileSync(PLIST_PATH, plist, "utf-8");

    try {
      await execAsync(`launchctl unload "${PLIST_PATH}"`);
      await new Promise((r) => setTimeout(r, 1200));
      await execAsync(`launchctl load "${PLIST_PATH}"`);
    } catch (e) {
      return {
        ok: false,
        message:
          `Plist updated but service restart failed: ${String(e)}. ` +
          "Quit and reopen OpenClaw manually.",
      };
    }

    return {
      ok: true,
      message: "Done! OLLAMA_API_KEY added to the OpenClaw service. Waiting for gateway to come back online…",
      restarting: true,
    };
  }

  if (os === "linux") {
    // ── Linux: systemd user service ───────────────────────────────────────────
    const servicePath = SYSTEMD_PATHS.find((p) => existsSync(p));
    if (!servicePath) {
      return {
        ok: false,
        message:
          "Could not find openclaw-gateway.service. " +
          "Add manually: echo 'Environment=\"OLLAMA_API_KEY=ollama-local\"' to the [Service] section, " +
          "then run: systemctl --user daemon-reload && systemctl --user restart openclaw-gateway",
      };
    }

    let service = readFileSync(servicePath, "utf-8");
    if (!service.includes("OLLAMA_API_KEY")) {
      service = service.replace(
        /(\[Service\])/,
        '$1\nEnvironment="OLLAMA_API_KEY=ollama-local"\nEnvironment="OLLAMA_BASE_URL=http://localhost:11434"'
      );
      writeFileSync(servicePath, service, "utf-8");
    }

    try {
      await execAsync("systemctl --user daemon-reload");
      await execAsync("systemctl --user restart openclaw-gateway");
    } catch (e) {
      return {
        ok: false,
        message:
          `Service file updated but restart failed: ${String(e)}. ` +
          "Run: systemctl --user daemon-reload && systemctl --user restart openclaw-gateway",
      };
    }

    return {
      ok: true,
      message: "Done! OLLAMA_API_KEY added to the OpenClaw service and restarted.",
      restarting: true,
    };
  }

  return {
    ok: false,
    message: "Auto-fix is only supported on macOS and Linux.",
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { type } = await req.json() as { type: string };

    if (type === "ollama-daemon-env") {
      const result = await fixOllamaDaemonEnv();
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: false, message: `Unknown fix type: ${type}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
