/**
 * smoke-test-bundle.mjs
 *
 * Verifies that standalone-bundle is fully self-contained — no leaking
 * into the project's node_modules — before Tauri packages it.
 *
 * Run: node scripts/smoke-test-bundle.mjs
 * Or via: pnpm smoke-test
 *
 * What it checks:
 *  1. Server starts from an isolated temp directory (no project node_modules in PATH)
 *  2. /login returns 200 (server is alive)
 *  3. /api/auth/tauri?token=X sets the auth cookie correctly
 *  4. /api/overview returns 200 JSON (DB, better-sqlite3, all deps work)
 *  5. Prints a pass/fail summary with actionable errors
 */

import { cpSync, mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const root   = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, ".next", "standalone-bundle");
const tmpDir = join(root, ".smoke-test-tmp");
const dataDir = join(root, ".smoke-test-data");
const PORT   = 3299;  // use a port unlikely to conflict
const TOKEN  = "smoketest-token-abc123";
const SECRET = "smoketest-secret-xyz";

const NODE = [
  "/opt/homebrew/bin/node",
  "/usr/local/bin/node",
  "/usr/bin/node",
].find(p => existsSync(p)) ?? "node";

// ── Helpers ──────────────────────────────────────────────────────────────────

const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.error(`  ❌ ${msg}`); process.exitCode = 1; };

async function get(path, cookieVal) {
  const headers = cookieVal ? { Cookie: `clawdesk-auth=${cookieVal}` } : {};
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { headers, redirect: "manual" });
  return res;
}

async function waitForPort(ms = 8000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(300) });
      return true;
    } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  return false;
}

// ── Setup ────────────────────────────────────────────────────────────────────

if (!existsSync(bundle)) {
  console.error("❌  standalone-bundle not found. Run `pnpm build:desktop` first.");
  process.exit(1);
}

// Copy bundle to isolated temp dir (mimics what Tauri does: no project node_modules in scope)
if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });

console.log("📦 Copying bundle to isolated temp dir…");
cpSync(bundle, tmpDir, { recursive: true });

// ── Start server ─────────────────────────────────────────────────────────────

console.log(`🚀 Starting server on :${PORT}…`);
const serverProcess = spawn(NODE, [join(tmpDir, "server.js")], {
  env: {
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    CLAWDESK_DATA_DIR: dataDir,
    TAURI_AUTO_LOGIN: TOKEN,
    CLAWDESK_SECRET: SECRET,
    CLAWDESK_PASSWORD: "test-password",
    // Deliberately strip project paths from NODE_PATH to ensure full isolation
    NODE_PATH: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
serverProcess.stdout.on("data", d => { serverOutput += d; });
serverProcess.stderr.on("data", d => { serverOutput += d; });

// ── Tests ────────────────────────────────────────────────────────────────────

let ok = false;
try {
  ok = await waitForPort();
  if (!ok) {
    fail("Server did not start within 8s");
    console.error("--- Server output ---");
    console.error(serverOutput);
    process.exit(1);
  }
  pass("Server started");

  // 1. /login returns 200
  const loginRes = await get("/login");
  loginRes.status === 200
    ? pass(`/login → ${loginRes.status}`)
    : fail(`/login → ${loginRes.status} (expected 200)`);

  // 2. Unauthenticated request redirects to login
  const unauthRes = await get("/");
  (unauthRes.status === 307 || unauthRes.status === 302 || unauthRes.status === 308)
    ? pass(`/ unauthenticated → ${unauthRes.status} redirect`)
    : fail(`/ unauthenticated → ${unauthRes.status} (expected redirect)`);

  // 3. /api/auth/tauri sets cookie correctly
  const tauriRes = await get(`/api/auth/tauri?token=${TOKEN}`);
  const setCookie = tauriRes.headers.get("set-cookie") ?? "";
  if (setCookie.includes(SECRET)) {
    pass("/api/auth/tauri sets auth cookie");
  } else {
    fail(`/api/auth/tauri did not set expected cookie (got: ${setCookie.slice(0, 80)})`);
  }

  // 4. /api/overview returns 200 JSON
  const overviewRes = await get("/api/overview", SECRET);
  if (overviewRes.status === 200) {
    const body = await overviewRes.json();
    if (typeof body === "object" && "taskStats" in body) {
      pass("/api/overview → 200 JSON (DB + better-sqlite3 working)");
    } else {
      fail(`/api/overview returned unexpected JSON shape: ${JSON.stringify(body).slice(0, 120)}`);
    }
  } else {
    const text = await overviewRes.text().catch(() => "");
    fail(`/api/overview → ${overviewRes.status} (expected 200)\n    ${text.slice(0, 200)}`);
  }

  // 5. /api/agents returns 200 JSON
  const agentsRes = await get("/api/agents", SECRET);
  agentsRes.status === 200
    ? pass("/api/agents → 200")
    : fail(`/api/agents → ${agentsRes.status}`);

  // 6. /api/runtime-sources/auto-setup responds correctly (fresh DB → not_found or provisioned)
  const autoSetupRes = await get("/api/runtime-sources/auto-setup", SECRET);
  if (autoSetupRes.status === 200) {
    const body = await autoSetupRes.json();
    if ("provisioned" in body) {
      pass(`/api/runtime-sources/auto-setup → 200 (provisioned: ${body.provisioned}, reason: ${body.reason ?? "n/a"})`);
    } else {
      fail(`/api/runtime-sources/auto-setup returned unexpected shape: ${JSON.stringify(body)}`);
    }
  } else {
    fail(`/api/runtime-sources/auto-setup → ${autoSetupRes.status}`);
  }

} finally {
  serverProcess.kill();
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
}

// ── Summary ──────────────────────────────────────────────────────────────────

if (process.exitCode === 1) {
  console.error("\n🔴  Smoke test FAILED — bundle is not ready for packaging.");
} else {
  console.log("\n🟢  Smoke test passed — bundle is self-contained and ready.");
}
