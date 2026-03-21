/**
 * copy-standalone-assets.mjs
 *
 * Run after `next build` (output: "standalone").
 * Next.js copies server code to .next/standalone/ but does NOT copy:
 *   - public/          → static files served at /
 *   - .next/static/    → JS/CSS chunks served at /_next/static/
 *
 * This script copies both so the standalone server is fully self-contained.
 */

import { cpSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("❌  .next/standalone not found — run `next build` first");
  process.exit(1);
}

// 1. Copy public/ → .next/standalone/public/
const publicSrc = join(root, "public");
const publicDst = join(standalone, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDst, { recursive: true });
  console.log("✅  Copied public/");
} else {
  mkdirSync(publicDst, { recursive: true });
  console.log("ℹ️   public/ is empty — created placeholder");
}

// 2. Copy .next/static/ → .next/standalone/.next/static/
const staticSrc = join(root, ".next", "static");
const staticDst = join(standalone, ".next", "static");
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log("✅  Copied .next/static/");
} else {
  console.error("❌  .next/static not found — build may have failed");
  process.exit(1);
}

console.log("✅  Standalone assets ready →", standalone);
