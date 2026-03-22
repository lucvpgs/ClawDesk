"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeHistory, clearHistory, HistoryItem } from "@/lib/toast";
import { Bell, CheckCircle2, XCircle, Info, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function timeAgoShort(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_ICON = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
  warning: AlertTriangle,
} as const;

const TYPE_COLOR = {
  success: "text-emerald-400",
  error:   "text-red-400",
  info:    "text-blue-400",
  warning: "text-amber-400",
} as const;

export function NotificationBell() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<number>(Date.now());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeHistory(setHistory);
    return () => { unsub(); };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleOpen() {
    setOpen((prev) => {
      if (!prev) setLastSeenAt(Date.now()); // mark all as read when opening
      return !prev;
    });
  }

  const unread = history.filter((h) => h.timestamp > lastSeenAt).length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          "relative p-1.5 rounded transition-colors",
          open
            ? "text-zinc-300 bg-zinc-800"
            : "text-zinc-600 hover:text-zinc-300"
        )}
        title="Notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-violet-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-8 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-300">Notifications</span>
            {history.length > 0 && (
              <button
                onClick={() => { clearHistory(); }}
                className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                title="Clear all"
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {history.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-600">
                No notifications yet
              </div>
            ) : (
              history.map((item) => {
                const Icon = TYPE_ICON[item.type];
                const isNew = item.timestamp > lastSeenAt;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2.5 border-b border-zinc-800/60 last:border-0",
                      isNew && "bg-zinc-800/30"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", TYPE_COLOR[item.type])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 leading-snug">{item.message}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgoShort(item.timestamp)}</p>
                    </div>
                    {isNew && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
