"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Bot, CalendarClock, CheckSquare, Activity, Clock,
  AlertTriangle, RefreshCw, Zap, Brain, Star, GitBranch,
  Radio, ChevronRight, Circle,
} from "lucide-react";
import { cn, timeAgo, statusDot } from "@/lib/utils";
import { useRuntimeStore } from "@/lib/store";
import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverviewData {
  noRuntime?: boolean;
  runtimeSource?: { id: string; name: string; status: string; lastSeenAt: string | null; lastSyncAt: string | null };
  gateway: { alive: boolean; version?: string };
  primaryModel: string | null;
  fallbacks: string[];
  agentList: Array<{ id: string; name?: string; default?: boolean; model?: string; identity?: { emoji?: string } }>;
  agents?: Array<{ id: string; agentId: string; name: string | null; model: string | null; status: string | null }>;
  sessions?: Array<{ sessionId: string; agentId: string | null; status: string | null; channel: string | null }>;
  cronJobs: Array<{ id: string; name: string | null; schedule: string | null; enabled: boolean; agentId: string | null; nextRunAt: string | null }>;
  channels?: Array<{ channelType: string; status: string | null }>;
  recentActivity?: Array<{ id: string; eventType: string; summary: string | null; occurredAt: string }>;
  taskStats: { total: number; pending: number; inProgress: number; blocked: number; done: number };
  recentTasks: Array<{ id: string; title: string; status: string | null; priority: string | null }>;
  journal: { today: string; written: boolean; wordCount: number };
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400",
  high:   "text-orange-400",
  medium: "text-amber-400",
  low:    "text-zinc-500",
};

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-zinc-600",
  in_progress: "bg-blue-500",
  blocked:     "bg-red-500",
  done:        "bg-emerald-500",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { setActiveRuntime } = useRuntimeStore();
  const [alertDismissed, setAlertDismissed] = useState(false);
  // Track consecutive gateway failures to avoid flickering on transient blips
  const [gatewayFailCount, setGatewayFailCount] = useState(0);

  const { data, isLoading, error, refetch, isFetching } = useQuery<OverviewData>({
    queryKey: ["overview"],
    queryFn: () => fetch("/api/overview").then((r) => r.json()),
    refetchInterval: 15_000,   // slightly relaxed — CLI check is fast anyway
  });

  const { data: cronRuns } = useQuery<{ runs: unknown[]; failedCount: number }>({
    queryKey: ["cron-runs"],
    queryFn: () => fetch("/api/cron/runs").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data) return;
    if (data.noRuntime && !data.gateway?.alive) router.push("/onboarding");
    if (data.runtimeSource) {
      setActiveRuntime({
        id: data.runtimeSource.id,
        name: data.runtimeSource.name,
        gatewayUrl: "",
        status: data.runtimeSource.status,
      });
    }
    // Reset failure counter when gateway is confirmed alive
    if (data.gateway?.alive) setGatewayFailCount(0);
    else setGatewayFailCount((n) => n + 1);
  }, [data, router, setActiveRuntime]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm text-zinc-500">Loading…</div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle className="w-6 h-6 text-amber-400" />
      <div className="text-sm text-zinc-400">{String(error)}</div>
      <button onClick={() => refetch()} className="text-xs text-violet-400 hover:underline">Retry</button>
    </div>
  );

  if (!data) return null;

  const {
    runtimeSource, gateway, primaryModel, fallbacks, agentList,
    agents = [], sessions = [], cronJobs = [], channels = [],
    recentActivity = [], taskStats, recentTasks = [], journal,
  } = data;

  const activeSessions = sessions.filter((s) => s.status === "active" || s.status === "running");
  const enabledCrons   = cronJobs.filter((j) => j.enabled);
  const modelShort     = primaryModel ? primaryModel.split("/").pop() ?? primaryModel : null;
  const modelProvider  = primaryModel ? primaryModel.split("/")[0] : null;

  // Only show "Offline" after 2 consecutive failures — avoids flickering on transient blips
  const gatewayAlive   = gateway.alive || gatewayFailCount < 2;
  const gatewayLabel   = gateway.alive ? "Live" : gatewayFailCount < 2 ? "Checking…" : "Offline";
  const gatewayColor   = gateway.alive ? "text-emerald-400" : gatewayFailCount < 2 ? "text-zinc-500" : "text-red-400";
  const gatewayIcon    = gateway.alive ? "text-emerald-400" : gatewayFailCount < 2 ? "text-zinc-500" : "text-red-400";

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Overview</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {runtimeSource
              ? <>Mission control · synced {timeAgo(runtimeSource.lastSyncAt)}</>
              : "Mission control · local mode"}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className={cn("p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors", isFetching && "text-violet-400")}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* Cron failure alert */}
      {!alertDismissed && cronRuns && cronRuns.failedCount > 0 && (
        <div className="flex items-center gap-3 bg-red-950/30 border border-red-800/50 rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300 flex-1">
            {cronRuns.failedCount} cron job{cronRuns.failedCount > 1 ? "s" : ""} failed recently
          </span>
          <Link href="/schedules" className="text-[10px] text-red-400 hover:text-red-300 underline shrink-0">
            View schedules
          </Link>
          <button
            onClick={() => setAlertDismissed(true)}
            className="text-red-700 hover:text-red-500 ml-1 shrink-0 text-xs"
          >✕</button>
        </div>
      )}

      {/* Status bar — 4 quick indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        {/* Gateway */}
        <StatCard
          icon={<Zap className={cn("w-4 h-4", gatewayIcon)} />}
          label="Gateway"
          value={gatewayLabel}
          valueClass={gatewayColor}
          sub={gateway.version ?? "localhost:18789"}
          href="/system"
        />

        {/* Primary model */}
        <StatCard
          icon={<Star className="w-4 h-4 text-violet-400" />}
          label="Primary model"
          value={modelShort ?? "—"}
          valueClass="text-zinc-100"
          sub={modelProvider ?? "not set"}
          href="/models"
        />

        {/* Tasks */}
        <StatCard
          icon={<CheckSquare className="w-4 h-4 text-amber-400" />}
          label="Tasks"
          value={taskStats.pending + taskStats.inProgress}
          valueClass="text-zinc-100"
          sub={`${taskStats.inProgress} in progress · ${taskStats.blocked} blocked`}
          href="/tasks"
        />

        {/* Journal */}
        <StatCard
          icon={<Brain className={cn("w-4 h-4", journal.written ? "text-blue-400" : "text-zinc-600")} />}
          label="Journal today"
          value={journal.written ? `${journal.wordCount}w` : "Empty"}
          valueClass={journal.written ? "text-blue-400" : "text-zinc-600"}
          sub={journal.today}
          href="/memory"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Agents */}
        <Panel title="Agents" icon={<Bot className="w-3.5 h-3.5" />} href="/agents"
          badge={activeSessions.length > 0 ? `${activeSessions.length} active` : undefined}>
          {agentList.length === 0 && agents.length === 0 ? (
            <EmptyRow label="No agents configured" />
          ) : (
            (agentList.length > 0 ? agentList : agents).slice(0, 5).map((a, idx) => {
              const aId = "id" in a ? (a as { id: string }).id : (a as { agentId: string }).agentId;
              const rta = agents.find((ra) => ra.agentId === aId);
              const session = sessions.find((s) => s.agentId === aId);
              const cfgA = a as { id?: string; name?: string; default?: boolean; model?: string; identity?: { emoji?: string } };
              const emoji = cfgA.identity?.emoji ?? null;
              const name  = cfgA.name ?? rta?.name ?? aId ?? String(idx);
              const model = cfgA.model ?? rta?.model ?? null;
              const modelLabel = model ? model.split("/").pop() : null;
              return (
                <div key={aId ?? idx} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                    rta?.status ? statusDot(rta.status) : session ? "bg-blue-400" : "bg-zinc-700")} />
                  <span className="text-xs text-zinc-100 flex-1 truncate">
                    {emoji ? `${emoji} ` : ""}{name}
                    {cfgA.default && <span className="ml-1.5 text-[9px] text-violet-400 border border-violet-800/50 px-1 rounded">primary</span>}
                  </span>
                  {modelLabel && <span className="text-[10px] text-zinc-600 font-mono shrink-0">{modelLabel}</span>}
                </div>
              );
            })
          )}
          {fallbacks.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-1.5 border-t border-zinc-800/50">
              <GitBranch className="w-3 h-3 text-zinc-700 shrink-0" />
              <span className="text-[10px] text-zinc-600 truncate">
                Fallbacks: {fallbacks.map((f) => f.split("/").pop()).join(" → ")}
              </span>
            </div>
          )}
        </Panel>

        {/* Tasks */}
        <Panel title="Active tasks" icon={<CheckSquare className="w-3.5 h-3.5" />} href="/tasks"
          badge={taskStats.blocked > 0 ? `${taskStats.blocked} blocked` : undefined}
          badgeClass="text-red-400 border-red-900/50">
          {recentTasks.length === 0 ? (
            <EmptyRow label="No pending tasks" />
          ) : (
            recentTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_COLORS[t.status ?? ""] ?? "bg-zinc-700")} />
                <span className="text-xs text-zinc-200 flex-1 truncate">{t.title}</span>
                <span className={cn("text-[10px] shrink-0 capitalize", PRIORITY_COLORS[t.priority ?? ""] ?? "text-zinc-500")}>
                  {t.priority ?? "—"}
                </span>
              </div>
            ))
          )}
          {/* Stats bar */}
          <div className="px-4 py-2 border-t border-zinc-800/50 flex items-center gap-3 text-[10px] text-zinc-600">
            <span>{taskStats.pending} pending</span>
            <span className="text-zinc-700">·</span>
            <span>{taskStats.inProgress} in progress</span>
            <span className="text-zinc-700">·</span>
            <span>{taskStats.done} done</span>
          </div>
        </Panel>

        {/* Cron jobs — next runs */}
        <Panel title="Upcoming schedules" icon={<CalendarClock className="w-3.5 h-3.5" />} href="/schedules"
          badge={`${enabledCrons.length} active`}>
          {cronJobs.length === 0 ? (
            <EmptyRow label="No cron jobs configured" />
          ) : (() => {
            // Sort enabled jobs by nextRunAt asc, then disabled at the bottom
            const sorted = [...cronJobs].sort((a, b) => {
              if (!a.enabled && b.enabled) return 1;
              if (a.enabled && !b.enabled) return -1;
              if (!a.nextRunAt && !b.nextRunAt) return 0;
              if (!a.nextRunAt) return 1;
              if (!b.nextRunAt) return -1;
              return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
            });
            return sorted.slice(0, 5).map((j) => {
              const nextMs = j.nextRunAt ? new Date(j.nextRunAt).getTime() - Date.now() : null;
              const nextLabel = nextMs !== null
                ? nextMs < 60_000   ? "< 1 min"
                : nextMs < 3600_000 ? `${Math.round(nextMs / 60_000)}m`
                : nextMs < 86400_000 ? `${Math.round(nextMs / 3600_000)}h`
                : `${Math.round(nextMs / 86400_000)}d`
                : null;
              const isSoon = nextMs !== null && nextMs < 300_000; // < 5 min

              return (
                <div key={j.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                  <Circle className={cn("w-1.5 h-1.5 shrink-0", j.enabled ? "text-emerald-500 fill-emerald-500" : "text-zinc-700 fill-zinc-700")} />
                  <span className="text-xs text-zinc-200 flex-1 truncate">{j.name ?? j.id}</span>
                  {j.enabled && nextLabel ? (
                    <span className={cn(
                      "text-[10px] shrink-0 font-mono",
                      isSoon ? "text-amber-400" : "text-zinc-500"
                    )}>
                      {isSoon && <Clock className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />}
                      in {nextLabel}
                    </span>
                  ) : j.enabled ? (
                    <span className="text-[10px] text-zinc-600 shrink-0 font-mono">{j.schedule ?? "—"}</span>
                  ) : (
                    <span className="text-[10px] text-zinc-700 shrink-0">disabled</span>
                  )}
                </div>
              );
            });
          })()}
        </Panel>

        {/* Activity + channels */}
        <Panel title="Recent activity" icon={<Activity className="w-3.5 h-3.5" />} href="/activity">
          {/* Channels row */}
          {channels.length > 0 && (
            <div className="px-4 py-2 border-b border-zinc-800/50 flex items-center gap-2">
              <Radio className="w-3 h-3 text-zinc-700 shrink-0" />
              {channels.map((ch) => (
                <span key={ch.channelType} className="flex items-center gap-1 text-[10px]">
                  <span className={cn("w-1 h-1 rounded-full", statusDot(ch.status ?? ""))} />
                  <span className="text-zinc-500 capitalize">{ch.channelType}</span>
                </span>
              ))}
            </div>
          )}
          {recentActivity.length === 0 ? (
            <EmptyRow label="No activity yet" />
          ) : (
            recentActivity.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                <Clock className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
                <span className="text-xs text-zinc-400 flex-1 truncate">{e.summary ?? e.eventType}</span>
                <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(e.occurredAt)}</span>
              </div>
            ))
          )}
        </Panel>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, valueClass, sub, href }: {
  icon: React.ReactNode; label: string;
  value: string | number; valueClass?: string;
  sub: string; href?: string;
}) {
  const inner = (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className={cn("text-xl font-semibold truncate", valueClass ?? "text-zinc-100")}>{value}</div>
      <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{sub}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Panel({ title, icon, href, badge, badgeClass, children }: {
  title: string; icon: React.ReactNode; href: string;
  badge?: string; badgeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          {icon}{title}
          {badge && (
            <span className={cn("text-[9px] border px-1.5 py-0.5 rounded-full", badgeClass ?? "text-zinc-500 border-zinc-700")}>
              {badge}
            </span>
          )}
        </div>
        <Link href={href} className="flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="px-4 py-5 text-xs text-zinc-600 text-center">{label}</div>;
}
