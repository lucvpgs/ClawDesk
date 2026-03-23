import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const OPENCLAW_JSON = path.join(process.env.HOME!, ".openclaw", "openclaw.json");
const UPDATE_CHECK  = path.join(process.env.HOME!, ".openclaw", "update-check.json");

function getClawdeskVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Try to fetch the live running version from the gateway HTTP endpoint. */
async function liveGatewayVersion(gatewayUrl: string): Promise<string | null> {
  try {
    // /health returns { version, ... }
    const res = await fetch(`${gatewayUrl}/health`, {
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, unknown>;
    // Gateway returns version as `version` or `runtimeVersion`
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

    // Config-file version (set when openclaw last started and wrote its config)
    const configVersion: string = cfg?.meta?.lastTouchedVersion ?? "unknown";

    // Live version from the running gateway (more accurate — reflects restarts & updates)
    const port       = cfg?.gateway?.port ?? 18789;
    const gatewayUrl = `http://localhost:${port}`;
    const live       = await liveGatewayVersion(gatewayUrl);

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
      { openclawVersion: "unknown", clawdeskVersion: "1.0.0", updateAvailable: false },
      { status: 200 } // soft fail — don't crash the sidebar
    );
  }
}
