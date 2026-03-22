"use client";

/**
 * Offline license key system for ClawDesk Pro
 *
 * Key format:  CLWD-AAAA-BBBB-CCCC
 *   AAAA-BBBB = 8 random hex chars (unique per key)
 *   CCCC      = first 4 chars of HMAC-SHA256(AAAA-BBBB, SECRET)
 *
 * The embedded SECRET makes the scheme offline-only.
 * Key sharing is acceptable at the $39 price point.
 */

import { useState, useEffect, useCallback } from "react";

// Embedded secret — obfuscated enough for a $39 product
const SECRET = "clwd-7f3a9b2e-pro-2026";
const LS_KEY = "clawdesk:license";

export type LicenseState = "unknown" | "valid" | "invalid";

async function hmac4(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 4).toUpperCase();
}

export async function validateKey(raw: string): Promise<boolean> {
  const key = raw.trim().toUpperCase();
  const match = key.match(/^CLWD-([A-Z0-9]{4}-[A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!match) return false;
  const [, payload, checksum] = match;
  const expected = await hmac4(payload);
  return expected === checksum;
}

/** Read persisted key from localStorage (null if none) */
export function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_KEY);
}

/** Persist key to localStorage */
export function storeKey(key: string) {
  localStorage.setItem(LS_KEY, key.trim().toUpperCase());
}

/** Remove key from localStorage */
export function removeKey() {
  localStorage.removeItem(LS_KEY);
}

// ────────────────────────────────────────────────────────────
// React hook

export interface UseLicense {
  isPro: boolean;
  state: LicenseState;
  storedKey: string | null;
  activate: (key: string) => Promise<boolean>;
  deactivate: () => void;
}

export function useLicense(): UseLicense {
  const [state, setState] = useState<LicenseState>("unknown");
  const [storedKey, setStoredKey] = useState<string | null>(null);

  // Validate on mount
  useEffect(() => {
    const k = getStoredKey();
    setStoredKey(k);
    if (!k) {
      setState("unknown");
      return;
    }
    validateKey(k).then((ok) => setState(ok ? "valid" : "invalid"));
  }, []);

  const activate = useCallback(async (raw: string): Promise<boolean> => {
    const ok = await validateKey(raw);
    if (ok) {
      storeKey(raw);
      setStoredKey(raw.trim().toUpperCase());
      setState("valid");
    } else {
      setState("invalid");
    }
    return ok;
  }, []);

  const deactivate = useCallback(() => {
    removeKey();
    setStoredKey(null);
    setState("unknown");
  }, []);

  return {
    isPro: state === "valid",
    state,
    storedKey,
    activate,
    deactivate,
  };
}
