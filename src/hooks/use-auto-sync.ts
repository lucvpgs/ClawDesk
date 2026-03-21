"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const SYNC_INTERVAL = 60_000; // 60 seconds

export function useAutoSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const run = async () => {
      try {
        await fetch("/api/runtime-sources/sync", { method: "POST" });
        qc.invalidateQueries(); // refresh all cached data
      } catch { /* silent */ }
    };

    const id = setInterval(run, SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [qc]);
}
