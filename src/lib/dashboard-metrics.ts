/**
 * Dashboard metric definitions.
 * Each metric knows how to extract its value from the data available on the Overview page.
 */

export interface OverviewData {
  gateway: { alive: boolean; version?: string };
  primaryModel: string | null;
  fallbacks: string[];
  agentList: Array<{ id: string; name?: string; default?: boolean; model?: string }>;
  agents?: Array<{ id: string; agentId: string; name: string | null; model: string | null; status: string | null }>;
  sessions?: Array<{ sessionId: string; agentId: string | null; status: string | null; channel: string | null }>;
  cronJobs: Array<{ id: string; name: string | null; schedule: string | null; enabled: boolean; nextRunAt: string | null }>;
  recentActivity?: Array<{ id: string; eventType: string; summary: string | null; occurredAt: string }>;
  taskStats: { total: number; pending: number; inProgress: number; blocked: number; done: number };
  journal: { today: string; written: boolean; wordCount: number };
}

export interface CronRunsData {
  runs: Array<{ jobId: string; startedAt?: string; status?: string }>;
  failedCount: number;
}

export interface MetricResult {
  value: string | number;
  sub: string;
  valueClass: string;
  href: string;
}

export interface MetricDef {
  id: string;
  label: string;       // shown in dropdown
  cardLabel: string;   // shown as card title
  iconKey: string;     // maps to a lucide icon in the page
  compute: (data: OverviewData, cronRuns?: CronRunsData, failCount?: number) => MetricResult;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const METRICS: MetricDef[] = [
  // ── Gateway ──────────────────────────────────────────────────────────────
  {
    id: "gateway-status",
    label: "Gateway status",
    cardLabel: "Gateway",
    iconKey: "zap",
    compute: (data, _cr, failCount = 0) => {
      const alive = data.gateway.alive || failCount < 2;
      return {
        value: data.gateway.alive ? "Live" : failCount < 2 ? "Checking…" : "Offline",
        sub: data.gateway.version ?? "localhost:18789",
        valueClass: data.gateway.alive ? "text-emerald-400" : failCount < 2 ? "text-zinc-500" : "text-red-400",
        href: "/system",
      };
    },
  },

  // ── Model ─────────────────────────────────────────────────────────────────
  {
    id: "primary-model",
    label: "Primary model",
    cardLabel: "Primary model",
    iconKey: "star",
    compute: (data) => {
      const modelShort = data.primaryModel ? data.primaryModel.split("/").pop() ?? data.primaryModel : null;
      const provider   = data.primaryModel ? data.primaryModel.split("/")[0] : null;
      return {
        value: modelShort ?? "—",
        sub: provider ?? "not set",
        valueClass: "text-zinc-100",
        href: "/models",
      };
    },
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────
  {
    id: "tasks-active",
    label: "Tasks — active (pending + in progress)",
    cardLabel: "Active tasks",
    iconKey: "check-square",
    compute: (data) => ({
      value: data.taskStats.pending + data.taskStats.inProgress,
      sub: `${data.taskStats.inProgress} in progress · ${data.taskStats.blocked} blocked`,
      valueClass: "text-zinc-100",
      href: "/tasks",
    }),
  },
  {
    id: "tasks-pending",
    label: "Tasks — pending",
    cardLabel: "Pending tasks",
    iconKey: "check-square",
    compute: (data) => ({
      value: data.taskStats.pending,
      sub: `${data.taskStats.total} total`,
      valueClass: "text-zinc-100",
      href: "/tasks",
    }),
  },
  {
    id: "tasks-inprogress",
    label: "Tasks — in progress",
    cardLabel: "In progress",
    iconKey: "check-square",
    compute: (data) => ({
      value: data.taskStats.inProgress,
      sub: `${data.taskStats.pending} pending`,
      valueClass: "text-blue-400",
      href: "/tasks",
    }),
  },
  {
    id: "tasks-blocked",
    label: "Tasks — blocked",
    cardLabel: "Blocked tasks",
    iconKey: "check-square",
    compute: (data) => ({
      value: data.taskStats.blocked,
      sub: `${data.taskStats.inProgress} in progress`,
      valueClass: data.taskStats.blocked > 0 ? "text-red-400" : "text-zinc-500",
      href: "/tasks",
    }),
  },
  {
    id: "tasks-done",
    label: "Tasks — done (total)",
    cardLabel: "Done tasks",
    iconKey: "check-square",
    compute: (data) => {
      const pct = data.taskStats.total > 0
        ? Math.round((data.taskStats.done / data.taskStats.total) * 100)
        : 0;
      return {
        value: data.taskStats.done,
        sub: `${pct}% completion`,
        valueClass: "text-emerald-400",
        href: "/tasks",
      };
    },
  },
  {
    id: "tasks-total",
    label: "Tasks — total",
    cardLabel: "Total tasks",
    iconKey: "check-square",
    compute: (data) => ({
      value: data.taskStats.total,
      sub: `${data.taskStats.done} done · ${data.taskStats.pending} pending`,
      valueClass: "text-zinc-100",
      href: "/tasks",
    }),
  },

  // ── Cron ─────────────────────────────────────────────────────────────────
  {
    id: "crons-active",
    label: "Crons — active (enabled)",
    cardLabel: "Active crons",
    iconKey: "calendar-clock",
    compute: (data) => {
      const active = data.cronJobs.filter((j) => j.enabled).length;
      return {
        value: active,
        sub: `${data.cronJobs.length} total`,
        valueClass: "text-zinc-100",
        href: "/schedules",
      };
    },
  },
  {
    id: "crons-total",
    label: "Crons — total",
    cardLabel: "Total crons",
    iconKey: "calendar-clock",
    compute: (data) => {
      const active = data.cronJobs.filter((j) => j.enabled).length;
      return {
        value: data.cronJobs.length,
        sub: `${active} enabled`,
        valueClass: "text-zinc-100",
        href: "/schedules",
      };
    },
  },
  {
    id: "crons-run-today",
    label: "Crons — run today",
    cardLabel: "Crons today",
    iconKey: "calendar-clock",
    compute: (_data, cronRuns) => {
      const today = todayStr();
      const runToday = (cronRuns?.runs ?? []).filter((r) => r.startedAt?.startsWith(today)).length;
      const total    = (cronRuns?.runs ?? []).length;
      return {
        value: runToday,
        sub: `${total} recent runs total`,
        valueClass: runToday > 0 ? "text-emerald-400" : "text-zinc-500",
        href: "/schedules",
      };
    },
  },
  {
    id: "crons-remaining-today",
    label: "Crons — remaining today",
    cardLabel: "Crons remaining",
    iconKey: "calendar-clock",
    compute: (data, cronRuns) => {
      const today = todayStr();
      // Enabled crons with nextRunAt today
      const remainingToday = data.cronJobs.filter(
        (j) => j.enabled && j.nextRunAt?.startsWith(today)
      ).length;
      const ranToday = (cronRuns?.runs ?? []).filter((r) => r.startedAt?.startsWith(today)).length;
      return {
        value: remainingToday,
        sub: `${ranToday} already ran today`,
        valueClass: remainingToday > 0 ? "text-amber-400" : "text-zinc-500",
        href: "/schedules",
      };
    },
  },
  {
    id: "crons-failed",
    label: "Crons — failed recently",
    cardLabel: "Cron failures",
    iconKey: "calendar-clock",
    compute: (_data, cronRuns) => ({
      value: cronRuns?.failedCount ?? 0,
      sub: `${cronRuns?.runs?.length ?? 0} recent runs`,
      valueClass: (cronRuns?.failedCount ?? 0) > 0 ? "text-red-400" : "text-emerald-400",
      href: "/schedules",
    }),
  },

  // ── Agents & Sessions ─────────────────────────────────────────────────────
  {
    id: "agents-total",
    label: "Agents — total configured",
    cardLabel: "Agents",
    iconKey: "bot",
    compute: (data) => ({
      value: data.agentList.length || (data.agents?.length ?? 0),
      sub: "configured agents",
      valueClass: "text-zinc-100",
      href: "/agents",
    }),
  },
  {
    id: "sessions-active",
    label: "Sessions — active",
    cardLabel: "Active sessions",
    iconKey: "bot",
    compute: (data) => {
      const active = (data.sessions ?? []).filter(
        (s) => s.status === "active" || s.status === "running"
      ).length;
      return {
        value: active,
        sub: `${data.sessions?.length ?? 0} total sessions`,
        valueClass: active > 0 ? "text-emerald-400" : "text-zinc-500",
        href: "/agents",
      };
    },
  },

  // ── Journal ───────────────────────────────────────────────────────────────
  {
    id: "journal-today",
    label: "Journal — today",
    cardLabel: "Journal today",
    iconKey: "brain",
    compute: (data) => ({
      value: data.journal.written ? `${data.journal.wordCount}w` : "Empty",
      sub: data.journal.today,
      valueClass: data.journal.written ? "text-blue-400" : "text-zinc-600",
      href: "/memory",
    }),
  },

  // ── Activity ──────────────────────────────────────────────────────────────
  {
    id: "activity-today",
    label: "Activity — events today",
    cardLabel: "Events today",
    iconKey: "activity",
    compute: (data) => {
      const today = todayStr();
      const todayCount = (data.recentActivity ?? []).filter(
        (e) => e.occurredAt.startsWith(today)
      ).length;
      return {
        value: todayCount,
        sub: `${data.recentActivity?.length ?? 0} recent total`,
        valueClass: todayCount > 0 ? "text-zinc-100" : "text-zinc-600",
        href: "/activity",
      };
    },
  },
];

export const METRICS_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m]));

export const DEFAULT_SLOT_METRICS = [
  "gateway-status",
  "primary-model",
  "tasks-active",
  "journal-today",
];
