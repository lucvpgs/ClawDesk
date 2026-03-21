"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Zap, Bot, CalendarClock, CheckSquare } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface ActivityEvent {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  occurredAt: string;
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  sync:      <Zap className="w-3 h-3 text-violet-400" />,
  "cron.run": <CalendarClock className="w-3 h-3 text-blue-400" />,
  agent:     <Bot className="w-3 h-3 text-emerald-400" />,
  task:      <CheckSquare className="w-3 h-3 text-amber-400" />,
};

export default function ActivityPage() {
  const { data, isLoading, refetch } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity"],
    queryFn: () => fetch("/api/activity").then((r) => r.json()),
    refetchInterval: 5_000,
  });

  const events = data?.events ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
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
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-zinc-800" />

          <div className="space-y-0">
            {events.map((event, i) => (
              <EventRow key={event.id} event={event} isLast={i === events.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const icon = EVENT_ICON[event.eventType] ?? <Zap className="w-3 h-3 text-zinc-500" />;

  return (
    <div className="flex gap-4 group">
      {/* Icon on timeline */}
      <div className="relative z-10 flex items-center justify-center w-10 h-10 shrink-0">
        <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center group-hover:border-zinc-600 transition-colors">
          {icon}
        </div>
      </div>

      {/* Content */}
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
