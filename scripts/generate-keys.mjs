#!/usr/bin/env node
/**
 * ClawDesk Pro — License Key Generator
 *
 * Usage:
 *   node scripts/generate-keys.mjs              → generează 1 cheie
 *   node scripts/generate-keys.mjs 10           → generează 10 chei
 *   node scripts/generate-keys.mjs 1 lucvpgs    → cheie cu payload custom
 *
 * Format: CLWD-AAAA-BBBB-CCCC
 *   AAAA-BBBB = 8 hex chars random (sau custom)
 *   CCCC      = primele 4 chars HMAC-SHA256(AAAA-BBBB, SECRET)
 */

import { createHmac, randomBytes } from "node:crypto";

const SECRET = "clwd-7f3a9b2e-pro-2026";

function hmac4(payload) {
  return createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();
}

function randomPayload() {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

function generateKey(customPayload) {
  const payload = customPayload
    ? customPayload.toUpperCase().slice(0, 9).padEnd(9, "X").replace(/^(.{4})(.{4})$/, "$1-$2").slice(0, 9)
    : randomPayload();
  const checksum = hmac4(payload);
  return `CLWD-${payload}-${checksum}`;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const count   = parseInt(process.argv[2]) || 1;
const custom  = process.argv[3] || null;

if (count === 1 && custom) {
  // Single key with custom payload (e.g. for a specific customer)
  const payload = custom.toUpperCase().padEnd(8, "0").slice(0, 8);
  const formatted = `${payload.slice(0,4)}-${payload.slice(4,8)}`;
  const key = `CLWD-${formatted}-${hmac4(formatted)}`;
  console.log(key);
} else {
  // Bulk random keys
  const keys = Array.from({ length: count }, () => generateKey(null));
  keys.forEach(k => console.log(k));
}
