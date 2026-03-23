"use client";

/**
 * Client-side license state management for ClawDesk Pro.
 *
 * Validation is intentionally server-side only (/api/license).
 * The secret never appears in the client bundle.
 */

import { useState, useEffect, useCallback } from "react";

const LS_KEY = "clawdesk:license";

export type LicenseState = "unknown" | "valid" | "invalid";

/** Read persisted key from localStorage (null if none) */
export function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_KEY);
}

/** Persist key to localStorage (display only — not authoritative) */
function storeKey(key: string) {
  localStorage.setItem(LS_KEY, key.trim().toUpperCase());
}

/** Remove key from localStorage */
function removeKey() {
  localStorage.removeItem(LS_KEY);
}

// ── React hook ────────────────────────────────────────────────────────────────

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

  // On mount: check server-side status (authoritative)
  useEffect(() => {
    fetch("/api/license")
      .then((r) => r.json())
      .then((data) => {
        if (data.isPro && data.key) {
          storeKey(data.key);
          setStoredKey(data.key);
          setState("valid");
        } else {
          // Server says not Pro — clear any stale localStorage
          removeKey();
          setStoredKey(null);
          setState("unknown");
        }
      })
      .catch(() => {
        // Fallback: use localStorage if server unreachable (app starting up)
        const k = getStoredKey();
        setStoredKey(k);
        setState(k ? "valid" : "unknown");
      });
  }, []);

  const activate = useCallback(async (raw: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: raw }),
      });
      const data = await res.json();
      if (data.ok) {
        const normalized = raw.trim().toUpperCase();
        storeKey(normalized);
        setStoredKey(normalized);
        setState("valid");
        return true;
      }
    } catch { /* network error */ }
    setState("invalid");
    return false;
  }, []);

  const deactivate = useCallback(async () => {
    removeKey();
    setStoredKey(null);
    setState("unknown");
    try {
      await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });
    } catch { /* best-effort */ }
  }, []);

  return {
    isPro: state === "valid",
    state,
    storedKey,
    activate,
    deactivate,
  };
}
