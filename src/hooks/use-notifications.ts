"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface ActivityEvent {
  id: string;
  eventType: string;
  summary: string | null;
  occurredAt: string;
}

// Event types worth notifying about
const NOTIFY_TYPES = new Set([
  "cron.run",
  "agent",
  "task_created",
  "task_updated",
  "task_deleted",
  "project_created",
  "project_updated",
  "project_deleted",
]);

const STORAGE_KEY = "clawdesk:last_notified_event";

function notificationBody(event: ActivityEvent): string {
  if (event.summary) return event.summary;
  switch (event.eventType) {
    case "cron.run":        return "Cron job executed";
    case "agent":           return "Agent session update";
    case "task_created":    return "New task created";
    case "task_updated":    return "Task updated";
    case "task_deleted":    return "Task deleted";
    case "project_created": return "New project created";
    case "project_updated": return "Project updated";
    case "project_deleted": return "Project deleted";
    default:                return event.eventType;
  }
}

function notificationTitle(eventType: string): string {
  switch (eventType) {
    case "cron.run":        return "⏰ Cron";
    case "agent":           return "🤖 Agent";
    case "task_created":
    case "task_updated":
    case "task_deleted":    return "✅ Task";
    case "project_created":
    case "project_updated":
    case "project_deleted": return "📁 Project";
    default:                return "ClawDesk";
  }
}

async function requestPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

function fireNotification(event: ActivityEvent) {
  try {
    const n = new Notification(notificationTitle(event.eventType), {
      body: notificationBody(event),
      icon: "/icon.png",
      tag: event.id,          // deduplicates if fired twice
      silent: false,
    });
    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6_000);
  } catch {
    // Notifications blocked or unsupported — silently skip
  }
}

export function useNotifications() {
  const permGranted   = useRef(false);
  const initialized   = useRef(false);
  const lastEventId   = useRef<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );

  // Request permission once on mount
  useEffect(() => {
    requestPermission().then((ok) => { permGranted.current = ok; });
  }, []);

  const { data } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity-notify"],
    queryFn: () => fetch("/api/activity").then((r) => r.json()),
    refetchInterval: 8_000,   // slightly offset from the activity page's 5s
    staleTime: 0,
  });

  useEffect(() => {
    if (!data?.events || !permGranted.current) return;

    const events = data.events.filter((e) => NOTIFY_TYPES.has(e.eventType));
    if (events.length === 0) return;

    // On first load just record the newest ID, don't fire stale notifications
    if (!initialized.current) {
      initialized.current = true;
      const newest = events[0]; // API returns newest-first
      if (newest) {
        lastEventId.current = newest.id;
        localStorage.setItem(STORAGE_KEY, newest.id);
      }
      return;
    }

    const prevId = lastEventId.current;
    const newEvents: ActivityEvent[] = [];

    for (const event of events) {
      if (event.id === prevId) break; // reached already-seen boundary
      newEvents.push(event);
    }

    if (newEvents.length === 0) return;

    // Fire notifications for new events (oldest first for natural ordering)
    newEvents.reverse().forEach(fireNotification);

    // Persist newest seen ID
    const newest = events[0];
    lastEventId.current = newest.id;
    localStorage.setItem(STORAGE_KEY, newest.id);
  }, [data]);
}
