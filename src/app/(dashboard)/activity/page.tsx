"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Zap, Bot, CalendarClock, CheckSquare, X, Clock } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface ActivityEvent {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  rawJson: string | null;
  occurredAt: string;
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  sync:       <Zap className="w-3 h-3 text-violet-400" />,
  "cron.run": <CalendarClock className="w-3 h-3 text-blue-400" />,
  agent:      <Bot className="w-3 h-3 text-emerald-400" />,
  task:       <CheckSquare className="w-3 h-3 text-amber-400" />,
};

const EVENT_COLOR: Record<string, string> = {
  sync:       "text-violet-400 bg-violet-900/20 border-violet-800/40",
  "cron.run": "text-blue-400 bg-blue-900/20 border-blue-800/40",
  agent:      "text-emerald-400 bg-emerald-900/20 border-emerald-800/40",
  task:       "text-amber-400 bg-amber-900/20 border-amber-800/40",
};

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-GB", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function formatRawJson(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function ActivityPage() {
  const [selected, setSelected] = useState<ActivityEvent | null>(null);

  const { data, isLoading, refetch } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity"],
    queryFn: () => fetch("/api/activity").then((r) => r.json()),
    refetchInterval: 5_000,
  });

  const events = data?.events ?? [];

  return (
    <div className="flex gap-4 h-full">
      {/* Event list */}
      <div className={`space-y-4 transition-all duration-200 ${selected ? "flex-1 min-w-0" : "max-w-3xl w-full mx-auto"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-zinc-100">Activity</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{events.length} events</p>
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Activity className="w-8 h-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">No activity yet.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-zinc-800" />
            <div className="space-y-0">
              {events.map((event, i) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isLast={i === events.length - 1}
                  isSelected={selected?.id === event.id}
                  onClick={() => setSelected(selected?.id === event.id ? null : event)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-96 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4 self-start sticky top-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200">Event Detail</span>
            <button
              onClick={() => setSelected(null)}
              className="p-1 text-zinc-600 hover:text-zinc-300 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Type badge */}
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono ${EVENT_COLOR[selected.eventType] ?? "text-zinc-400 bg-zinc-800/50 border-zinc-700/50"}`}>
            {EVENT_ICON[selected.eventType] ?? <Zap className="w-3 h-3" />}
            {selected.eventType}
          </div>

          {/* Fields */}
          <div className="space-y-2.5">
            <DetailRow label="Summary" value={selected.summary ?? "—"} />
            {selected.entityType && <DetailRow label="Entity type" value={selected.entityType} mono />}
            {selected.entityId   && <DetailRow label="Entity ID"   value={selected.entityId}   mono />}
            <DetailRow label="ID" value={selected.id} mono />
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Time</span>
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <Clock className="w-3 h-3 text-zinc-600" />
                <span>{formatTimestamp(selected.occurredAt)}</span>
                <span className="text-zinc-600">({timeAgo(selected.occurredAt)})</span>
              </div>
            </div>
          </div>

          {/* Raw JSON */}
          {selected.rawJson && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Payload</span>
              <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {formatRawJson(selected.rawJson)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventRow({
  event, isLast, isSelected, onClick,
}: {
  event: ActivityEvent;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const icon = EVENT_ICON[event.eventType] ?? <Zap className="w-3 h-3 text-zinc-500" />;

  return (
    <div
      onClick={onClick}
      className={`flex gap-4 group cursor-pointer rounded-lg transition-colors ${isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"}`}
    >
      <div className="relative z-10 flex items-center justify-center w-10 h-10 shrink-0">
        <div className={`w-6 h-6 rounded-full bg-zinc-900 border flex items-center justify-center transition-colors ${isSelected ? "border-violet-600" : "border-zinc-700 group-hover:border-zinc-600"}`}>
          {icon}
        </div>
      </div>

      <div className={`flex-1 py-2 ${isLast ? "" : "border-b border-zinc-800/40"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs text-zinc-300">{event.summary ?? event.eventType}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                {event.eventType}
              </span>
              {event.entityType && (
                <span className="text-[10px] text-zinc-700">{event.entityType}</span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">{timeAgo(event.occurredAt)}</span>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</span>
      <p className={`text-xs text-zinc-300 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
