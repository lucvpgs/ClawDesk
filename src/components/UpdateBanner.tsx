"use client";

import { useEffect, useState } from "react";
import { Download, X, RefreshCw } from "lucide-react";

interface UpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  notes?: string;
  error?: string;
}

// Check if we're running inside Tauri
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;

    // Check for updates 5s after app load (non-blocking)
    const timer = setTimeout(async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<UpdateInfo>("check_update");
        if (result.available) setUpdate(result);
      } catch {
        // Silently ignore — updater not critical
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!update?.available || dismissed) return null;

  async function handleInstall() {
    setInstalling(true);
    setInstallError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("install_update");
      // app restarts automatically after this
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInstallError(msg);
      setInstalling(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-violet-500/40 bg-zinc-900/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-sm max-w-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20">
        <Download className="h-4 w-4 text-violet-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100">
          ClawDesk {update.version} disponibil
        </p>
        <p className="text-[10px] text-zinc-500 truncate">
          Current version: {update.currentVersion}
        </p>
      </div>

      <button
        onClick={handleInstall}
        disabled={installing}
        className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors shrink-0"
      >
        {installing ? (
          <><RefreshCw className="h-3 w-3 animate-spin" /> Installing…</>
        ) : (
          "Update Now"
        )}
      </button>

      <button
        onClick={() => setDismissed(true)}
        className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {installError && (
        <div className="absolute bottom-full mb-2 right-0 max-w-sm rounded-lg border border-red-500/30 bg-zinc-900 px-3 py-2 text-[10px] text-red-400 shadow-lg">
          {installError}
        </div>
      )}
    </div>
  );
}
