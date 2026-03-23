"use client";

import { useBackupScheduler } from "@/hooks/use-backup-scheduler";

export function BackupScheduler() {
  useBackupScheduler();
  return null;
}
