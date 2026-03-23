"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock, Play, RefreshCw, List, Calendar, Plus,
  X, Save, Trash2, AlertCircle, ChevronRight, ToggleLeft, ToggleRight,
  Clock, Bot, Terminal, Radio, CheckCircle2, Loader2, ChevronDown, ChevronUp,
  History,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { agentAccent, agentDisplayName, agentInitial, KNOWN_AGENTS, RuntimeAgent } from "@/lib/agent-colors";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CronJob {
  id: string;
  jobId: string;
  name: string | null;
  agentId: string | null;
  schedule: string | null;
  prompt: string | null;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  outputTarget: string | null;
  /** Discord channel ID, Telegram chat ID, E.164 — maps to delivery.to in OpenClaw */
  deliveryTo: string | null;
  tags: string[];
  // runtime
  status: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

// ── Cron helpers ───────────────────────────────────────────────────────────────
const SCHEDULE_PRESETS = [
  { label: "Every 15 min",  value: "*/15 * * * *" },
  { label: "Every 30 min",  value: "*/30 * * * *" },
  { label: "Every hour",    value: "0 * * * *"    },
  { label: "Every 2 hours", value: "0 */2 * * *"  },
  { label: "Every 6 hours", value: "0 */6 * * *"  },
  { label: "Daily 9am",     value: "0 9 * * *"    },
  { label: "Daily 6pm",     value: "0 18 * * *"   },
  { label: "Mon–Fri 9am",   value: "0 9 * * 1-5"  },
  { label: "Weekly Mon",    value: "0 9 * * 1"    },
  { label: "Custom…",       value: "custom"        },
];

function parseCronDays(schedule: string | null): number[] {
  if (!schedule) return [0, 1, 2, 3, 4, 5, 6];
  const fields = schedule.trim().split(/\s+/);
  if (fields.length < 5) return [0, 1, 2, 3, 4, 5, 6];
  const dow = fields[4];
  if (dow === "*") return [0, 1, 2, 3, 4, 5, 6];
  const days: number[] = [];
  for (const part of dow.split(",")) {
    if (part.includes("-")) {
      const [s, e] = part.split("-").map(Number);
      for (let d = s; d <= e; d++) days.push(d % 7);
    } else if (part.includes("/")) {
      const [base, step] = part.split("/");
      const start = base === "*" ? 0 : parseInt(base);
      for (let d = start; d <= 6; d += parseInt(step)) days.push(d % 7);
    } else {
      const n = parseInt(part);
      if (!isNaN(n)) days.push(n % 7);
    }
  }
  return days.length > 0 ? [...new Set(days)] : [0, 1, 2, 3, 4, 5, 6];
}

function isHighFrequency(schedule: string | null): boolean {
  if (!schedule) return false;
  const f = schedule.trim().split(/\s+/);
  if (f.length < 2) return false;
  if (f[0] === "*") return true;
  if (f[0].startsWith("*/")) {
    const s = parseInt(f[0].slice(2));
    if (!isNaN(s) && s <= 15) return true;
  }
  if (f[1].startsWith("*/")) {
    const s = parseInt(f[1].slice(2));
    if (!isNaN(s) && s <= 5) return true;
  }
  return false;
}

function getWeekDays(): Date[] {
  const today = new Date();
  const day   = today.getDay();
  const mon   = new Date(today);
  mon.setDate(today.getDate() - ((day + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const qc = useQueryClient();
  const [view, setView]           = useState<"week" | "list">("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ jobs: CronJob[] }>({
    queryKey: ["schedules"],
    queryFn:  () => fetch("/api/schedules").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  const { data: agentsData } = useQuery<{ agents: RuntimeAgent[] }>({
    queryKey: ["agents"],
    queryFn: () => fetch("/api/agents").then((r) => r.json()),
    refetchInterval: 30_000,
  });
  const agentList: RuntimeAgent[] = agentsData?.agents?.length
    ? agentsData.agents
    : KNOWN_AGENTS.map((a) => ({ agentId: a.id, name: a.name }));

  const runMutation = useMutation({
    mutationFn: (jobId: string) =>
      fetch("/api/schedules", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "run", jobId }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const jobs       = data?.jobs ?? [];
  const selectedJob = selectedId ? jobs.find((j) => j.id === selectedId) ?? null : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Schedules</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {jobs.length} cron job{jobs.length !== 1 ? "s" : ""}
            {jobs.filter((j) => j.enabled).length !== jobs.length && (
              <span className="text-zinc-700 ml-1">
                ({jobs.filter((j) => j.enabled).length} enabled)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setView("week")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                view === "week" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Calendar className="w-3 h-3" />
              Week
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                view === "list" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <List className="w-3 h-3" />
              List
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New schedule
          </button>
          <button
            onClick={() => refetch()}
            className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <CalendarClock className="w-8 h-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">No cron jobs configured.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create first schedule
          </button>
        </div>
      ) : view === "list" ? (
        <ListView
          jobs={jobs}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          onRun={(jobId) => runMutation.mutate(jobId)}
          runningJobId={runMutation.isPending ? (runMutation.variables ?? null) : null}
        />
      ) : (
        <CalendarView
          jobs={jobs}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          onRun={(jobId) => runMutation.mutate(jobId)}
          runningJobId={runMutation.isPending ? (runMutation.variables ?? null) : null}
        />
      )}

      {/* Detail panel */}
      {selectedJob && (
        <JobDetailPanel
          job={selectedJob}
          agents={agentList}
          onClose={() => setSelectedId(null)}
          onSaved={() => { setSelectedId(null); qc.invalidateQueries({ queryKey: ["schedules"] }); }}
          onRun={() => runMutation.mutate(selectedJob.jobId)}
          running={runMutation.isPending && runMutation.variables === selectedJob.jobId}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateScheduleModal
          agents={agentList}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["schedules"] }); }}
        />
      )}
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({
  jobs, selectedId, onSelect, onRun, runningJobId,
}: {
  jobs: CronJob[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRun: (jobId: string) => void;
  runningJobId: string | null;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Job</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Agent</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Schedule</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Status</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Last run</th>
            <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Next run</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              selected={selectedId === job.id}
              onSelect={() => onSelect(job.id)}
              onRun={() => onRun(job.jobId)}
              running={runningJobId === job.jobId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobRow({
  job, selected, onSelect, onRun, running,
}: {
  job: CronJob;
  selected: boolean;
  onSelect: () => void;
  onRun: () => void;
  running: boolean;
}) {
  const accent = agentAccent(job.agentId);

  return (
    <tr
      onClick={onSelect}
      className={cn(
        "cursor-pointer transition-colors border-l-4",
        accent.border,
        selected ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            job.enabled ? "bg-emerald-400" : "bg-zinc-600"
          )} />
          <span className="text-zinc-200 font-medium text-xs">{job.name ?? job.jobId}</span>
        </div>
        <div className="text-[10px] text-zinc-600 font-mono mt-0.5 ml-3.5">{job.id}</div>
      </td>
      <td className="px-4 py-3">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", accent.badge)}>
          {agentDisplayName(job.agentId)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
          {job.schedule ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded",
          !job.enabled         ? "bg-zinc-800 text-zinc-600"
          : job.status === "active" ? "bg-emerald-900/30 text-emerald-400"
          : "bg-zinc-800 text-zinc-500"
        )}>
          {!job.enabled ? "disabled" : (job.status ?? "active")}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">{timeAgo(job.lastRunAt) ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-zinc-500">{timeAgo(job.nextRunAt) ?? "—"}</td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onRun}
          disabled={running || !job.enabled}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors disabled:opacity-40"
          title={!job.enabled ? "Job is disabled" : "Run now"}
        >
          <Play className={cn("w-3 h-3", running && "animate-pulse")} />
          {running ? "Running…" : "Run"}
        </button>
      </td>
    </tr>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({
  jobs, selectedId, onSelect, onRun, runningJobId,
}: {
  jobs: CronJob[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRun: (jobId: string) => void;
  runningJobId: string | null;
}) {
  const weekDays   = getWeekDays();
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const highFreq   = jobs.filter((j) => isHighFrequency(j.schedule));
  const scheduled  = jobs.filter((j) => !isHighFrequency(j.schedule));
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const nextUp = [...jobs]
    .filter((j) => j.nextRunAt && j.enabled)
    .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* High-frequency jobs */}
      {highFreq.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">High Frequency</div>
          <div className="flex flex-wrap gap-2">
            {highFreq.map((job) => {
              const accent = agentAccent(job.agentId);
              return (
                <button
                  key={job.id}
                  onClick={() => onSelect(job.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-opacity border",
                    accent.badge,
                    !job.enabled && "opacity-40"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", job.enabled ? accent.dot : "bg-zinc-600")} />
                  {job.name ?? job.id}
                  <span className="font-mono opacity-60 ml-0.5">{job.schedule}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Week grid */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-zinc-800">
          <span className="text-xs text-zinc-400 font-medium">
            Week of {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {" – "}
            {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <div className="grid grid-cols-7 divide-x divide-zinc-800/60">
          {weekDays.map((day, dayIdx) => {
            const isToday   = day.getTime() === today.getTime();
            const dayNumber = day.getDay();
            const dayJobs   = scheduled.filter((job) =>
              job.enabled && parseCronDays(job.schedule).includes(dayNumber)
            );
            const disabledJobs = scheduled.filter((job) =>
              !job.enabled && parseCronDays(job.schedule).includes(dayNumber)
            );

            return (
              <div key={dayIdx} className={cn("min-h-[120px] p-2", isToday && "bg-violet-950/20")}>
                <div className={cn(
                  "text-[10px] font-medium mb-1.5",
                  isToday ? "text-violet-400" : "text-zinc-500"
                )}>
                  {DAY_LABELS[dayIdx]}
                  <span className={cn("ml-1", isToday ? "text-violet-300" : "text-zinc-700")}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayJobs.map((job) => {
                    const accent = agentAccent(job.agentId);
                    return (
                      <button
                        key={job.id}
                        onClick={() => onSelect(job.id)}
                        title={`${job.name ?? job.id} — ${job.schedule}`}
                        className={cn(
                          "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate transition-opacity border",
                          accent.badge,
                          selectedId === job.id && "ring-1 ring-white/20"
                        )}
                      >
                        {job.name ?? job.id}
                      </button>
                    );
                  })}
                  {disabledJobs.map((job) => (
                    <div
                      key={job.id}
                      title={`${job.name ?? job.id} — disabled`}
                      className="text-[10px] px-1.5 py-0.5 rounded truncate text-zinc-700 bg-zinc-800/40 border border-zinc-800/40 line-through"
                    >
                      {job.name ?? job.id}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Up */}
      {nextUp.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Next Up</div>
          <div className="space-y-2">
            {nextUp.map((job) => {
              const accent = agentAccent(job.agentId);
              return (
                <div key={job.id} className="flex items-center gap-3">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", accent.dot)} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onSelect(job.id)}
                      className="text-xs text-zinc-300 font-medium hover:text-zinc-100 text-left"
                    >
                      {job.name ?? job.id}
                    </button>
                    <span className="text-[10px] text-zinc-600 ml-2 font-mono">{job.schedule}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 shrink-0">{timeAgo(job.nextRunAt)}</span>
                  <button
                    onClick={() => onRun(job.jobId)}
                    disabled={runningJobId === job.jobId}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors disabled:opacity-50"
                  >
                    <Play className={cn("w-2.5 h-2.5", runningJobId === job.jobId && "animate-pulse")} />
                    {runningJobId === job.jobId ? "Running…" : "Run"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Job Detail Panel ───────────────────────────────────────────────────────────
function JobDetailPanel({
  job, agents, onClose, onSaved, onRun, running,
}: {
  job: CronJob;
  agents: RuntimeAgent[];
  onClose: () => void;
  onSaved: () => void;
  onRun: () => void;
  running: boolean;
}) {
  const accent = agentAccent(job.agentId);

  const [name,         setName]         = useState(job.name ?? "");
  const [agentId,      setAgentId]      = useState(job.agentId ?? agents[0]?.agentId ?? "");
  const [schedule,     setSchedule]     = useState(job.schedule ?? "");
  const [customSched,  setCustomSched]  = useState("");
  const [preset,       setPreset]       = useState<string>(
    SCHEDULE_PRESETS.find((p) => p.value === job.schedule)?.value ?? "custom"
  );
  const [prompt,       setPrompt]       = useState(job.prompt ?? "");
  const [outputTarget, setOutputTarget] = useState(job.outputTarget ?? "");
  const [deliveryTo,   setDeliveryTo]   = useState(job.deliveryTo ?? "");
  const [enabled,      setEnabled]      = useState(job.enabled);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const effectiveSchedule = preset === "custom" ? (customSched || schedule) : preset;

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/schedules/config/${job.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         name.trim() || undefined,
          agentId,
          schedule:     effectiveSchedule,
          prompt:       prompt.trim(),
          outputTarget: outputTarget.trim() || null,
          deliveryTo:   deliveryTo.trim() || null,
          enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/schedules/config/${job.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="w-[480px] bg-zinc-950 border-l border-zinc-800 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-3 px-5 py-4 border-b border-zinc-800 border-l-4 shrink-0", accent.border)}>
          <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-zinc-900 shrink-0", accent.avatar)}>
            {agentInitial(job.agentId)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-zinc-100 truncate">{job.name ?? job.id}</div>
            <div className="text-[10px] text-zinc-600 font-mono">{job.id}</div>
          </div>

          {/* Enabled toggle */}
          <button
            onClick={() => setEnabled(!enabled)}
            className={cn("flex items-center gap-1.5 text-[10px] transition-colors shrink-0", enabled ? "text-emerald-400" : "text-zinc-600")}
            title={enabled ? "Disable" : "Enable"}
          >
            {enabled
              ? <ToggleRight className="w-5 h-5" />
              : <ToggleLeft  className="w-5 h-5" />
            }
            {enabled ? "Enabled" : "Disabled"}
          </button>

          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-zinc-600 hover:text-zinc-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="mx-5 mt-4 bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3 shrink-0">
            <p className="text-xs text-red-300 mb-2">Delete <strong>{job.name ?? job.id}</strong> from jobs.json?</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded">
                Confirm delete
              </button>
              <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Name</label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily report…"
            />
          </div>

          {/* Agent */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
              <Bot className="w-3 h-3" /> Agent
            </label>
            <select
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.agentId} value={a.agentId}>{a.name ?? a.agentId}</option>
              ))}
            </select>
          </div>

          {/* Schedule */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> Schedule
            </label>
            <select
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                if (e.target.value !== "custom") setSchedule(e.target.value);
              }}
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {preset === "custom" && (
              <input
                className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-violet-500"
                placeholder="*/30 * * * *"
                value={customSched || schedule}
                onChange={(e) => { setCustomSched(e.target.value); setSchedule(e.target.value); }}
              />
            )}
            <div className="text-[10px] text-zinc-700 mt-1 font-mono">{effectiveSchedule}</div>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
              <Terminal className="w-3 h-3" /> Prompt
            </label>
            <textarea
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-300 outline-none focus:border-violet-500 resize-none font-mono"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agent do when this fires?"
            />
          </div>

          {/* Delivery */}
          <DeliverySection
            outputTarget={outputTarget}
            deliveryTo={deliveryTo}
            onTargetChange={(v) => { setOutputTarget(v); if (!v) setDeliveryTo(""); }}
            onDeliveryToChange={setDeliveryTo}
          />

          {/* Runtime metadata */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-3 py-2.5 space-y-1.5">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Runtime info</div>
            <MetaRow label="Last run"  value={timeAgo(job.lastRunAt) ?? "Never"} />
            <MetaRow label="Next run"  value={timeAgo(job.nextRunAt) ?? "Unknown"} />
            <MetaRow label="Created"   value={timeAgo(job.createdAt) ?? "—"} />
            {job.updatedAt && <MetaRow label="Updated" value={timeAgo(job.updatedAt) ?? "—"} />}
          </div>

          {/* Run history */}
          <RunHistory jobId={job.id} />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 shrink-0">
          <button
            onClick={onRun}
            disabled={running || !enabled}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 disabled:opacity-40 transition-colors"
            title={!enabled ? "Job is disabled" : "Run now"}
          >
            <Play className={cn("w-3.5 h-3.5", running && "animate-pulse")} />
            {running ? "Running…" : "Run now"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateScheduleModal({
  agents, onClose, onCreated,
}: {
  agents: RuntimeAgent[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name,         setName]         = useState("");
  const [agentId,      setAgentId]      = useState(agents[0]?.agentId ?? "");
  const [preset,       setPreset]       = useState("0 9 * * *");
  const [customSched,  setCustomSched]  = useState("");
  const [prompt,       setPrompt]       = useState("");
  const [outputTarget, setOutputTarget] = useState("");
  const [deliveryTo,   setDeliveryTo]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const schedule = preset === "custom" ? customSched : preset;

  async function handleCreate() {
    if (!name.trim() || !schedule.trim() || !prompt.trim()) {
      setError("Name, schedule, and prompt are required");
      return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/schedules/config", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         name.trim(),
          agentId,
          schedule:     schedule.trim(),
          prompt:       prompt.trim(),
          outputTarget: outputTarget.trim() || null,
          deliveryTo:   deliveryTo.trim() || null,
          enabled:      true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[480px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">New Schedule</h2>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</div>
          )}

          {/* Name */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Name</label>
            <input
              autoFocus
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
              placeholder="Daily report"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Agent */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Agent</label>
            <select
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.agentId} value={a.agentId}>{a.name ?? a.agentId}</option>
              ))}
            </select>
          </div>

          {/* Schedule */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Schedule</label>
            <select
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {preset === "custom" && (
              <input
                className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-violet-500"
                placeholder="*/30 * * * *"
                value={customSched}
                onChange={(e) => setCustomSched(e.target.value)}
              />
            )}
            <div className="text-[10px] text-zinc-700 mt-1 font-mono">{schedule || "—"}</div>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Prompt</label>
            <textarea
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-2 text-xs text-zinc-300 outline-none focus:border-violet-500 resize-none font-mono"
              rows={5}
              placeholder="What should the agent do when this fires?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Delivery */}
          <DeliverySection
            outputTarget={outputTarget}
            deliveryTo={deliveryTo}
            onTargetChange={(v) => { setOutputTarget(v); if (!v) setDeliveryTo(""); }}
            onDeliveryToChange={setDeliveryTo}
          />
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex gap-2 sticky bottom-0 bg-zinc-950">
          <button onClick={onClose} className="flex-1 py-2 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || !schedule.trim() || !prompt.trim()}
            className="flex-1 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-zinc-600 shrink-0">{label}</span>
      <span className="text-[10px] text-zinc-400 text-right">{value}</span>
    </div>
  );
}

// ── DeliverySection — with live channel validation ────────────────────────────
interface ChannelStatus { channelType: string; running: boolean | null; configured: boolean | null; probe?: { ok?: boolean } | null; }

function DeliverySection({
  outputTarget, deliveryTo, onTargetChange, onDeliveryToChange,
}: {
  outputTarget: string;
  deliveryTo: string;
  onTargetChange: (v: string) => void;
  onDeliveryToChange: (v: string) => void;
}) {
  const { data: channelData } = useQuery<{ channels: ChannelStatus[] }>({
    queryKey: ["channels"],
    queryFn: () => fetch("/api/channels").then((r) => r.json()),
    staleTime: 30_000,
  });

  const channels = channelData?.channels ?? [];

  function channelStatusFor(type: string): "running" | "configured" | "missing" | null {
    if (!type || type === "none") return null;
    const ch = channels.find((c) => c.channelType.toLowerCase() === type.toLowerCase());
    if (!ch) return "missing";
    // probe.ok = true means the bot is reachable and credentials work — treat as running
    if (ch.running || ch.probe?.ok) return "running";
    if (ch.configured) return "configured";
    return "missing";
  }

  const status = channelStatusFor(outputTarget);

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
        <Radio className="w-3 h-3" /> Delivery
      </label>
      <div className="flex gap-2">
        <select
          className="w-28 shrink-0 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
          value={outputTarget || "none"}
          onChange={(e) => onTargetChange(e.target.value === "none" ? "" : e.target.value)}
        >
          <option value="none">None</option>
          <option value="discord">Discord</option>
          <option value="telegram">Telegram</option>
          <option value="slack">Slack</option>
        </select>
        <input
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500 font-mono disabled:opacity-40"
          value={deliveryTo}
          onChange={(e) => onDeliveryToChange(e.target.value)}
          placeholder={
            outputTarget === "telegram" ? "Telegram chat ID" :
            outputTarget === "discord"  ? "Discord channel ID" :
            outputTarget === "slack"    ? "Slack channel ID"   :
            "Channel ID / destination"
          }
          disabled={!outputTarget || outputTarget === "none"}
        />
      </div>

      {/* Channel validation badge */}
      {status === "running" && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span className="capitalize">{outputTarget}</span> is configured and running
        </div>
      )}
      {status === "configured" && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
          <AlertCircle className="w-3 h-3" />
          <span className="capitalize">{outputTarget}</span> is configured but not running
        </div>
      )}
      {status === "missing" && (
        <div className="flex items-center gap-1.5 text-[10px] text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span className="capitalize">{outputTarget}</span> is not configured —{" "}
          <a href="/settings?tab=channels" className="underline underline-offset-2 hover:text-red-300">
            add it in Settings
          </a>
        </div>
      )}
      {status === "running" && outputTarget === "discord" && !deliveryTo && (
        <p className="text-[10px] text-amber-500/80">
          Discord channel ID required — right-click channel → Copy Channel ID
        </p>
      )}
      {deliveryTo && (
        <p className="text-[10px] text-zinc-600 font-mono">→ {outputTarget} · {deliveryTo}</p>
      )}
    </div>
  );
}

// ── RunHistory — last N runs for a specific job ───────────────────────────────
interface CronRun {
  id: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  output: string | null;
  error: string | null;
}

function RunHistory({ jobId }: { jobId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{ runs: CronRun[]; total: number }>({
    queryKey: ["job-runs", jobId],
    queryFn: () => fetch(`/api/schedules/${jobId}/runs`).then((r) => r.json()),
    enabled: expanded,
    staleTime: 30_000,
  });

  const runs = data?.runs ?? [];

  function formatDuration(ms: number | null) {
    if (ms === null) return null;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  }

  return (
    <div className="border border-zinc-800/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider">
          <History className="w-3 h-3" /> Run history
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="w-3 h-3 animate-spin text-violet-400" />}
          {expanded
            ? <ChevronUp   className="w-3.5 h-3.5 text-zinc-600" />
            : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-zinc-800/40">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading runs…
            </div>
          ) : runs.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-700">
              No runs recorded yet.
            </div>
          ) : (
            <>
              {runs.map((run, i) => {
                const runKey = run.id ?? String(i);
                const isExpRun = expandedRun === runKey;
                const isOk = run.status === "ok" || run.status === "success";
                const isErr = run.status === "error" || run.status === "failed";

                return (
                  <div key={runKey}>
                    <button
                      onClick={() => setExpandedRun(isExpRun ? null : runKey)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/30 transition-colors text-left"
                    >
                      {/* Status dot */}
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isOk  ? "bg-emerald-400" :
                        isErr ? "bg-red-400" :
                                "bg-zinc-500"
                      )} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-medium uppercase",
                            isOk  ? "text-emerald-400" :
                            isErr ? "text-red-400" :
                                    "text-zinc-400"
                          )}>
                            {run.status}
                          </span>
                          {run.durationMs !== null && (
                            <span className="text-[10px] text-zinc-600">
                              {formatDuration(run.durationMs)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">
                          {run.startedAt ? timeAgo(run.startedAt) : "—"}
                        </div>
                      </div>

                      {(run.output || run.error) && (
                        <ChevronRight className={cn(
                          "w-3 h-3 text-zinc-700 transition-transform shrink-0",
                          isExpRun && "rotate-90"
                        )} />
                      )}
                    </button>

                    {/* Expanded output */}
                    {isExpRun && (run.output || run.error) && (
                      <div className="px-3 pb-3">
                        <div className={cn(
                          "rounded px-2.5 py-2 text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed",
                          run.error
                            ? "bg-red-950/30 border border-red-900/40 text-red-400"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                        )}>
                          {run.error ?? run.output}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Refresh */}
              <div className="flex justify-end px-3 py-2">
                <button
                  onClick={() => refetch()}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Refresh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

