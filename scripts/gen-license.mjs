#!/usr/bin/env node
/**
 * ClawDesk Pro — offline license key generator
 *
 * Usage:
 *   node scripts/gen-license.mjs [count]
 *
 * Generates CLWD-AAAA-BBBB-CCCC keys where:
 *   AAAA-BBBB = 8 random hex chars (unique per key)
 *   CCCC      = first 4 chars of HMAC-SHA256(AAAA-BBBB, SECRET)
 *
 * Keep this script and SECRET offline/private.
 */

import { createHmac, randomBytes } from "crypto";

// Must match src/lib/license.ts
const SECRET = "clwd-7f3a9b2e-pro-2026";

function hmac4(payload) {
  return createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();
}

function genKey() {
  const rand = randomBytes(4).toString("hex").toUpperCase(); // 8 chars
  const part1 = rand.slice(0, 4);
  const part2 = rand.slice(4, 8);
  const payload = `${part1}-${part2}`;
  const checksum = hmac4(payload);
  return `CLWD-${part1}-${part2}-${checksum}`;
}

const count = parseInt(process.argv[2] ?? "1", 10);
for (let i = 0; i < count; i++) {
  console.log(genKey());
}
