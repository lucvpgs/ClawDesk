"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Zap, Bot, CalendarClock, CheckSquare,
         X, Clock, FolderKanban, ChevronDown, ChevronUp } from "lucide-react";
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

// sync events = runtime noise; everything else = real activity
const RUNTIME_TYPES = new Set(["sync"]);

const EVENT_ICON: Record<string, React.ReactNode> = {
  sync:            <Zap className="w-3 h-3 text-zinc-600" />,
  "cron.run":      <CalendarClock className="w-3 h-3 text-blue-400" />,
  agent:           <Bot className="w-3 h-3 text-emerald-400" />,
  task:            <CheckSquare className="w-3 h-3 text-amber-400" />,
  task_created:    <CheckSquare className="w-3 h-3 text-emerald-400" />,
  task_updated:    <CheckSquare className="w-3 h-3 text-amber-400" />,
  task_deleted:    <CheckSquare className="w-3 h-3 text-red-400" />,
  project_created: <FolderKanban className="w-3 h-3 text-violet-400" />,
  project_updated: <FolderKanban className="w-3 h-3 text-violet-400" />,
  project_deleted: <FolderKanban className="w-3 h-3 text-red-400" />,
};

const EVENT_COLOR: Record<string, string> = {
  "cron.run":      "text-blue-400 bg-blue-900/20 border-blue-800/40",
  agent:           "text-emerald-400 bg-emerald-900/20 border-emerald-800/40",
  task:            "text-amber-400 bg-amber-900/20 border-amber-800/40",
  task_created:    "text-emerald-400 bg-emerald-900/20 border-emerald-800/40",
  task_updated:    "text-amber-400 bg-amber-900/20 border-amber-800/40",
  task_deleted:    "text-red-400 bg-red-900/20 border-red-800/40",
  project_created: "text-violet-400 bg-violet-900/20 border-violet-800/40",
  project_updated: "text-violet-400 bg-violet-900/20 border-violet-800/40",
  project_deleted: "text-red-400 bg-red-900/20 border-red-800/40",
  sync:            "text-zinc-600 bg-zinc-800/30 border-zinc-700/30",
};

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-GB", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return ts; }
}

function formatRawJson(raw: string | null) {
  if (!raw) return null;
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

export default function ActivityPage() {
  const [selected, setSelected]         = useState<ActivityEvent | null>(null);
  const [syncExpanded, setSyncExpanded] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity"],
    queryFn: () => fetch("/api/activity").then((r) => r.json()),
    refetchInterval: 5_000,
  });

  const events      = data?.events ?? [];
  const mainEvents  = events.filter((e) => !RUNTIME_TYPES.has(e.eventType));
  const syncEvents  = events.filter((e) => RUNTIME_TYPES.has(e.eventType));

  return (
    <div className="flex gap-4">
      {/* Left — event lists */}
      <div className={`space-y-5 transition-all duration-200 ${selected ? "flex-1 min-w-0" : "max-w-3xl w-full mx-auto"}`}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-zinc-100">Activity</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {mainEvents.length} events · {syncEvents.length} runtime syncs
            </p>
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
        ) : (
          <>
            {/* ── Section 1: Real events ──────────────────────────────────── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">Events</span>
                <span className="ml-auto text-[10px] text-zinc-600">{mainEvents.length}</span>
              </div>

              {mainEvents.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Activity className="w-7 h-7 text-zinc-800" />
                  <p className="text-xs text-zinc-600">No events yet.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[35px] top-2 bottom-2 w-px bg-zinc-800" />
                  {mainEvents.map((event, i) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      isLast={i === mainEvents.length - 1}
                      isSelected={selected?.id === event.id}
                      onClick={() => setSelected(selected?.id === event.id ? null : event)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 2: Runtime syncs ────────────────────────────────── */}
            {syncEvents.length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setSyncExpanded((v) => !v)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-zinc-800/30 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-zinc-700" />
                  <span className="text-xs font-medium text-zinc-600">Runtime syncs</span>
                  <span className="ml-auto text-[10px] text-zinc-700 mr-1">{syncEvents.length}</span>
                  {syncExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-zinc-700" />
                    : <ChevronDown className="w-3.5 h-3.5 text-zinc-700" />}
                </button>

                {syncExpanded && (
                  <div className="border-t border-zinc-800/60">
                    {syncEvents.map((event, i) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        isLast={i === syncEvents.length - 1}
                        isSelected={selected?.id === event.id}
                        onClick={() => setSelected(selected?.id === event.id ? null : event)}
                        dim
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right — detail panel */}
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
            <DetailRow label="Summary"     value={selected.summary ?? "—"} />
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
  event, isLast, isSelected, onClick, dim = false,
}: {
  event: ActivityEvent;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
  dim?: boolean;
}) {
  const icon = EVENT_ICON[event.eventType] ?? <Zap className="w-3 h-3 text-zinc-500" />;

  return (
    <div
      onClick={onClick}
      className={`flex gap-4 group cursor-pointer px-2 transition-colors rounded-lg mx-2 my-0.5
        ${isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"}`}
    >
      <div className="relative z-10 flex items-center justify-center w-10 h-10 shrink-0">
        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors
          ${dim ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-900 border-zinc-700 group-hover:border-zinc-600"}
          ${isSelected ? "!border-violet-600" : ""}`}>
          {icon}
        </div>
      </div>

      <div className={`flex-1 py-2.5 ${isLast ? "" : "border-b border-zinc-800/40"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`text-xs ${dim ? "text-zinc-600" : "text-zinc-300"}`}>
              {event.summary ?? event.eventType}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
                ${dim ? "text-zinc-700 bg-zinc-800/30" : "text-zinc-600 bg-zinc-800/50"}`}>
                {event.eventType}
              </span>
              {event.entityType && (
                <span className="text-[10px] text-zinc-700">{event.entityType}</span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-zinc-700 shrink-0 mt-0.5">{timeAgo(event.occurredAt)}</span>
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
