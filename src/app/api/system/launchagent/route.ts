/**
 * /api/system/launchagent
 * GET  — return current LaunchAgent status (installed / running / plist path)
 * POST — action: "install" | "uninstall" | "start" | "stop"
 *
 * The LaunchAgent runs the ClawDesk Next.js server at login independently of
 * the Tauri window, so the OpenClaw agent can interact with ClawDesk even when
 * the desktop app is closed.
 */
import { NextRequest, NextResponse } from "next/server";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { homedir } from "os";

const LABEL        = "com.vpgs.clawdesk.server";
const PLIST_PATH   = path.join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const APP_PATH     = "/Applications/ClawDesk.app";
const SERVER_JS    = path.join(APP_PATH, "Contents", "Resources", "server", "server.js");
const DATA_DIR     = path.join(homedir(), "Library", "Application Support", "com.vpgs.clawdesk");
const LOG_DIR      = path.join(homedir(), "Library", "Logs", "ClawDesk");

// Candidate Node.js paths (same as lib.rs)
const NODE_CANDIDATES = [
  "/opt/homebrew/bin/node",
  "/usr/local/bin/node",
  "/usr/bin/node",
];

function findNode(): string {
  for (const p of NODE_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const r = spawnSync("which", ["node"], { encoding: "utf-8" });
    const found = r.stdout?.trim();
    if (found) return found;
  } catch { /* ignore */ }
  return "node";
}

function buildPlist(nodePath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${SERVER_JS}</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>3131</string>
    <key>HOSTNAME</key>
    <string>127.0.0.1</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>CLAWDESK_DATA_DIR</key>
    <string>${DATA_DIR}</string>
  </dict>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/server.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/server.error.log</string>
</dict>
</plist>
`;
}

function isInstalled(): boolean {
  return fs.existsSync(PLIST_PATH);
}

function isLoaded(): boolean {
  try {
    const r = spawnSync("launchctl", ["list", LABEL], { encoding: "utf-8" });
    return r.status === 0;
  } catch { return false; }
}

function isServerUp(): boolean {
  try {
    // Quick check: can we connect to port 3131?
    execSync("nc -z 127.0.0.1 3131", { timeout: 1000, stdio: "ignore" });
    return true;
  } catch { return false; }
}

function launchctlBoot(load: boolean): void {
  // macOS 10.11+ — use bootout/bootstrap with gui uid
  try {
    const uid = spawnSync("id", ["-u"], { encoding: "utf-8" }).stdout?.trim() ?? "501";
    const domain = `gui/${uid}`;
    const action = load ? "bootstrap" : "bootout";
    spawnSync("launchctl", [action, domain, PLIST_PATH], { encoding: "utf-8" });
  } catch { /* ignore */ }
}

export async function GET() {
  const installed = isInstalled();
  const loaded    = installed ? isLoaded() : false;
  const running   = loaded   ? isServerUp() : false;

  return NextResponse.json({
    installed,
    loaded,
    running,
    plistPath:  PLIST_PATH,
    serverJs:   SERVER_JS,
    appPresent: fs.existsSync(APP_PATH),
    logDir:     LOG_DIR,
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action: string };

  if (action === "install") {
    // Require the app bundle to exist
    if (!fs.existsSync(SERVER_JS)) {
      return NextResponse.json({
        ok: false,
        error: `ClawDesk app not found at ${APP_PATH}. Install the release build first.`,
      }, { status: 400 });
    }

    const nodePath = findNode();
    const plist    = buildPlist(nodePath);

    // Ensure LaunchAgents dir and log dir exist
    fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true });
    fs.mkdirSync(LOG_DIR, { recursive: true });

    // If already loaded, unload first so changes take effect
    if (isLoaded()) {
      launchctlBoot(false);
    }

    fs.writeFileSync(PLIST_PATH, plist, "utf-8");
    launchctlBoot(true);

    return NextResponse.json({ ok: true, plistPath: PLIST_PATH, nodePath });
  }

  if (action === "uninstall") {
    if (isLoaded()) {
      launchctlBoot(false);
    }
    if (fs.existsSync(PLIST_PATH)) {
      fs.unlinkSync(PLIST_PATH);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "start") {
    launchctlBoot(true);
    return NextResponse.json({ ok: true });
  }

  if (action === "stop") {
    launchctlBoot(false);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
