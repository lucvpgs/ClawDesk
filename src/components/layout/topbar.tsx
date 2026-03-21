"use client";

import { useRuntimeStore } from "@/lib/store";
import { statusDot } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAutoSync } from "@/hooks/use-auto-sync";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function Topbar() {
  const { activeRuntime } = useRuntimeStore();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

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
        <button
          onClick={handleSync}
          disabled={syncing}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded disabled:opacity-50"
          title="Sync"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        </button>
      </div>
    </header>
  );
}
