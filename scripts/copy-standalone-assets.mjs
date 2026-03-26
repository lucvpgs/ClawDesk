/**
 * copy-standalone-assets.mjs
 *
 * Run after `next build` (output: "standalone").
 *
 * 1. Copy public/ and .next/static/ into .next/standalone/ so the standalone
 *    server is self-contained.
 *
 * 2. Create .next/standalone-bundle/ — a fully-dereferenced copy of the
 *    standalone directory (no symlinks) for Tauri bundling.
 *    Excludes runtime artifacts: data/, skill/
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { basename, join, dirname } from "path";
import { fileURLToPath } from "url";

const root       = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");
const bundle     = join(root, ".next", "standalone-bundle");

if (!existsSync(standalone)) {
  console.error("❌  .next/standalone not found — run `next build` first");
  process.exit(1);
}

// ── Step 1: copy public/ and .next/static/ into standalone ───────────────────

const publicSrc = join(root, "public");
const publicDst = join(standalone, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDst, { recursive: true });
  console.log("✅  Copied public/");
} else {
  mkdirSync(publicDst, { recursive: true });
  console.log("ℹ️   public/ is empty — created placeholder");
}

const staticSrc = join(root, ".next", "static");
const staticDst = join(standalone, ".next", "static");
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log("✅  Copied .next/static/");
} else {
  console.error("❌  .next/static not found — build may have failed");
  process.exit(1);
}

// ── Step 1b: copy src/mcp/ into standalone so agents can launch the MCP server ─
// The MCP server is launched via stdio by Claude Code / OpenClaw agents.
// It must be present in the bundle at a stable path inside the .app.

const mcpSrc = join(root, "src", "mcp");
const mcpDst = join(standalone, "src", "mcp");
if (existsSync(mcpSrc)) {
  cpSync(mcpSrc, mcpDst, { recursive: true });
  console.log("✅  Copied src/mcp/");
} else {
  console.warn("⚠️   src/mcp/ not found — MCP server will not be available in bundle");
}

// ── Step 1c: copy skill/ into standalone so the install route can find it ────
// The install API reads skill/SKILL.md from process.cwd() at runtime.
// process.cwd() in production = the standalone-bundle directory, so we must
// include skill/ there.

const skillSrc = join(root, "skill");
const skillDst = join(standalone, "skill");
if (existsSync(skillSrc)) {
  cpSync(skillSrc, skillDst, { recursive: true });
  console.log("✅  Copied skill/");
} else {
  console.warn("⚠️   skill/ not found — skill install will fail at runtime");
}

// ── Step 2: create dereferenced bundle copy (no symlinks) ────────────────────
// Tauri bundles resources by walking the directory; resolved symlinks ensure
// that node_modules (pnpm symlink structure) are bundled correctly.
// Runtime artifacts (data/) are excluded. skill/ IS included (see step 1b).

const EXCLUDE = new Set(["data"]);

if (existsSync(bundle)) {
  rmSync(bundle, { recursive: true, force: true });
}

cpSync(standalone, bundle, {
  recursive: true,
  dereference: true, // resolve all symlinks to real files
  filter: (src) => !EXCLUDE.has(basename(src)),
});

console.log("✅  Created standalone-bundle/ (dereferenced, no data/ or skill/)");
console.log("✅  Standalone ready →", standalone);
