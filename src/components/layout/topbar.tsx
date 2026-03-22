"use client";

import { useRuntimeStore } from "@/lib/store";
import { statusDot } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAutoSync } from "@/hooks/use-auto-sync";
import { RefreshCw, Search, Sun, Moon, KeyRound, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CommandPalette, useCommandPalette } from "@/components/CommandPalette";
import { useTheme } from "@/components/ThemeProvider";
import { NotificationBell } from "@/components/NotificationBell";
import { useLicenseContext } from "@/contexts/LicenseContext";

export function Topbar() {
  const { activeRuntime } = useRuntimeStore();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const { open, setOpen } = useCommandPalette();
  const { theme, toggle } = useTheme();
  const { isPro, openModal } = useLicenseContext();

  useAutoSync();

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/runtime-sources/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      await qc.invalidateQueries();
      toast("Synced successfully", "success");
    } catch {
      toast("Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 gap-3 sticky top-0 z-10">
      {/* Runtime badge */}
      {activeRuntime ? (
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusDot(activeRuntime.status)}`}
          />
          <span className="text-zinc-400">{activeRuntime.name}</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-600 font-mono text-[10px]">
            {activeRuntime.gatewayUrl}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          No runtime connected
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* ⌘K search trigger */}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1 text-zinc-600 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors text-xs"
          title="Search (⌘K)"
        >
          <Search className="w-3 h-3" />
          <span className="hidden sm:block">Search</span>
          <kbd className="hidden sm:block text-[10px] font-mono bg-zinc-900 border border-zinc-700 rounded px-1">⌘K</kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark"
            ? <Sun  className="w-3.5 h-3.5" />
            : <Moon className="w-3.5 h-3.5" />
          }
        </button>

        {/* Pro badge / upgrade button */}
        {isPro ? (
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-600/15 border border-violet-700/40 text-violet-300 text-[10px] font-medium hover:bg-violet-600/25 transition-colors"
            title="ClawDesk Pro — click to manage license"
          >
            <Sparkles className="w-3 h-3" />
            Pro
          </button>
        ) : (
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-700 text-zinc-500 text-[10px] font-medium hover:border-violet-700 hover:text-violet-400 transition-colors"
            title="Upgrade to ClawDesk Pro"
          >
            <KeyRound className="w-3 h-3" />
            Upgrade
          </button>
        )}

        {/* Notification bell */}
        <NotificationBell />

        <button
          onClick={handleSync}
          disabled={syncing}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded disabled:opacity-50"
          title="Sync"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
