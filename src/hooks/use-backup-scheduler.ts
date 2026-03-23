"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";

interface ScheduleConfig {
  schedule: "daily" | "weekly" | "off";
  folder: string;
  lastBackupAt: string | null;
}

interface AutoBackupResult {
  ok: boolean;
  savedTo: string;
  deletedOld: string[];
}

function isBackupDue(config: ScheduleConfig): boolean {
  if (config.schedule === "off") return false;
  if (config.lastBackupAt === null) return true;

  const last = new Date(config.lastBackupAt).getTime();
  const now = Date.now();
  const elapsedMs = now - last;

  if (config.schedule === "daily") {
    return elapsedMs > 24 * 60 * 60 * 1000;
  }
  if (config.schedule === "weekly") {
    return elapsedMs > 7 * 24 * 60 * 60 * 1000;
  }
  return false;
}

export function useBackupScheduler(): void {
  useEffect(() => {
    let cancelled = false;

    async function check() {
      let config: ScheduleConfig;
      try {
        const res = await fetch("/api/backup/schedule");
        if (!res.ok) return;
        config = (await res.json()) as ScheduleConfig;
      } catch {
        return;
      }

      if (cancelled) return;
      if (!isBackupDue(config)) return;

      try {
        const res = await fetch("/api/backup/auto", { method: "POST" });
        if (!res.ok) throw new Error(`Auto-backup failed (${res.status})`);
        const result = (await res.json()) as AutoBackupResult;
        if (!cancelled) {
          toast(`Auto-backup saved to ${result.savedTo}`, "success");
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Auto-backup failed";
          toast(message, "error");
        }
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, []);
}
