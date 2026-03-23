/**
 * Server-side license validation for ClawDesk Pro.
 * Uses Node.js crypto — runs only in API routes, never in client bundles.
 */
import { createHmac } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";

const SECRET = "clwd-7f3a9b2e-pro-2026";
const CLAWDESK_JSON = path.join(homedir(), ".openclaw", "clawdesk.json");

function hmac4(payload: string): string {
  return createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();
}

export function validateKeyServer(raw: string): boolean {
  const key = raw.trim().toUpperCase();
  const match = key.match(/^CLWD-([A-Z0-9]{4}-[A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!match) return false;
  const [, payload, checksum] = match;
  return hmac4(payload) === checksum;
}

// ── Persist to / read from clawdesk.json ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readClawdeskJson(): any {
  try {
    if (existsSync(CLAWDESK_JSON)) {
      return JSON.parse(readFileSync(CLAWDESK_JSON, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeClawdeskJson(data: any): void {
  mkdirSync(path.dirname(CLAWDESK_JSON), { recursive: true });
  writeFileSync(CLAWDESK_JSON, JSON.stringify(data, null, 2), "utf-8");
}

/** Returns the stored license key if it exists and is still valid. */
export function getActivatedKey(): string | null {
  try {
    const data = readClawdeskJson();
    const key = data?.license?.key;
    if (typeof key === "string" && validateKeyServer(key)) return key;
  } catch { /* ignore */ }
  return null;
}

/** Returns true if a valid Pro license is stored on disk. */
export function isProActivated(): boolean {
  return getActivatedKey() !== null;
}

/** Saves a validated key to clawdesk.json. Returns false if key is invalid. */
export function activateLicense(raw: string): boolean {
  const key = raw.trim().toUpperCase();
  if (!validateKeyServer(key)) return false;
  const data = readClawdeskJson();
  data.license = { key, activatedAt: new Date().toISOString() };
  writeClawdeskJson(data);
  return true;
}

/** Removes the license from clawdesk.json. */
export function deactivateLicense(): void {
  const data = readClawdeskJson();
  delete data.license;
  writeClawdeskJson(data);
}
