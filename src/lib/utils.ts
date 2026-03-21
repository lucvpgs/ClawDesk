import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "never";
  // SQLite datetime('now') returns UTC without timezone marker (e.g. "2026-03-21 22:21:47").
  // JS treats such strings as local time → wrong diff for users outside UTC.
  // Normalize: replace space separator with T and append Z to force UTC parsing.
  const normalized = /[Z+]/.test(dateStr) ? dateStr : dateStr.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function statusColor(status: string): string {
  switch (status) {
    case "connected": return "text-emerald-400";
    case "degraded": return "text-amber-400";
    case "disconnected": return "text-zinc-500";
    case "error": return "text-red-400";
    case "active": return "text-emerald-400";
    case "done": return "text-blue-400";
    case "blocked": return "text-red-400";
    default: return "text-zinc-400";
  }
}

export function statusDot(status: string): string {
  switch (status) {
    case "connected": case "active": return "bg-emerald-400";
    case "degraded": return "bg-amber-400";
    case "error": case "blocked": return "bg-red-400";
    default: return "bg-zinc-500";
  }
}
