import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { homedir } from "os";
import { cliRun } from "@/server/cli-run";

const OPENCLAW_JSON = path.join(homedir(), ".openclaw", "openclaw.json");
const UPDATE_CHECK  = path.join(homedir(), ".openclaw", "update-check.json");

function getClawdeskVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Try CLI first (most reliable), then HTTP health endpoint. */
async function liveOpenClawVersion(gatewayUrl: string): Promise<string | null> {
  // 1. CLI — `openclaw status --json` returns { runtimeVersion, heartbeat }
  try {
    const out  = cliRun(["status", "--json"], { timeout: 4_000 });
    const json = JSON.parse(out) as Record<string, unknown>;
    const v    = json?.runtimeVersion as string | undefined;
    if (v) return v;
  } catch { /* CLI unavailable — fall through */ }

  // 2. HTTP /health fallback
  try {
    const res = await fetch(`${gatewayUrl}/health`, {
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, unknown>;
    const v = (json.version ?? json.runtimeVersion) as string | undefined;
    return v ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cfg         = JSON.parse(fs.readFileSync(OPENCLAW_JSON, "utf8"));
    const updateCheck = fs.existsSync(UPDATE_CHECK)
      ? JSON.parse(fs.readFileSync(UPDATE_CHECK, "utf8"))
      : {};

    // Config-file version — only used as last resort (stale after updates)
    const configVersion: string = cfg?.meta?.lastTouchedVersion ?? "unknown";

    // Live version: CLI → HTTP → config file
    const port    = cfg?.gateway?.port ?? 18789;
    const live    = await liveOpenClawVersion(`http://localhost:${port}`);

    // Prefer live version; fall back to config version
    const openclawVersion = live ?? configVersion;

    const lastCheckedAt:   string  = updateCheck?.lastCheckedAt ?? null;
    const latestAvailable: string  = updateCheck?.latestVersion  ?? null;
    const updateAvailable: boolean = !!latestAvailable && latestAvailable !== openclawVersion;

    return NextResponse.json({
      openclawVersion,
      lastCheckedAt,
      latestAvailable,
      updateAvailable,
      clawdeskVersion: getClawdeskVersion(),
    });
  } catch {
    return NextResponse.json(
      { openclawVersion: "unknown", clawdeskVersion: getClawdeskVersion(), updateAvailable: false },
      { status: 200 } // soft fail — don't crash the sidebar
    );
  }
}
