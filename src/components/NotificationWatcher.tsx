"use client";

import { useNotifications } from "@/hooks/use-notifications";

/**
 * Mounts the notification hook — no visible UI.
 * Include once in the dashboard layout.
 */
export function NotificationWatcher() {
  useNotifications();
  return null;
}
