"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, X, RefreshCw, Circle, CheckCircle2, AlertCircle,
  ChevronDown, Save, CalendarClock, ExternalLink, Clock,
  MessageSquare, Send, Trash2, User, Bot, XCircle, Link2, Timer,
} from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { cn, timeAgo } from "@/lib/utils";
import { agentAccent, agentInitial, agentDisplayName, KNOWN_AGENTS, RuntimeAgent } from "@/lib/agent-colors";
import { projectAccent } from "@/lib/project-colors";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedAgentId: string | null;
  projectId: string | null;
  linkedCronJobId: string | null;
  linkedSessionId: string | null;
  proof: string | null;
  notes: string | null;
  dueAt: string | null;
  createdAt: string;
  // state machine fields
  dependencies: string | null;         // JSON array
  requiresReview: boolean | null;
  maxRetries: number | null;
  retryCount: number | null;
  nextTaskTemplate: string | null;     // JSON: { title, description?, priority?, assignedAgentId? }
  // temporal tracking
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  failedAt: string | null;
}

interface Project { id: string; name: string; status: string; }

// ── Status config ─────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: "todo",        label: "Backlog",     dot: "bg-zinc-500"    },
  { key: "in_progress", label: "In Progress", dot: "bg-blue-400"    },
  { key: "review",      label: "Review",      dot: "bg-amber-400"   },
  { key: "done",        label: "Done",        dot: "bg-emerald-400" },
  { key: "failed",      label: "Failed",      dot: "bg-red-500"     },
];

// All valid statuses (for the detail panel selector)
const ALL_STATUSES = [
  { key: "todo",             label: "Backlog"          },
  { key: "in_progress",      label: "In Progress"      },
  { key: "review",           label: "Review"           },
  { key: "blocked",          label: "Blocked"          },
  { key: "done",             label: "Done"             },
  { key: "failed",           label: "Failed"           },
  { key: "cancelled",        label: "Cancelled"        },
  { key: "promoted_to_cron", label: "Promoted to Cron" },
];

const STATUS_CHIP: Record<string, string> = {
  todo:             "bg-zinc-800 text-zinc-400 border-zinc-700",
  in_progress:      "bg-blue-900/40 text-blue-300 border-blue-700/50",
  review:           "bg-amber-900/40 text-amber-300 border-amber-700/50",
  blocked:          "bg-red-900/40 text-red-300 border-red-700/50",
  done:             "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
  failed:           "bg-red-900/60 text-red-200 border-red-600/50",
  cancelled:        "bg-zinc-900 text-zinc-600 border-zinc-800",
  promoted_to_cron: "bg-violet-900/40 text-violet-300 border-violet-700/50",
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(ALL_STATUSES.map((s) => [s.key, s.label]));

const NEXT_STATUS: Record<string, string> = {
  todo:        "in_progress",
  in_progress: "review",
  review:      "done",
  blocked:     "in_progress",
  failed:      "todo",
  done:        "todo",
  cancelled:   "todo",
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-zinc-600", medium: "text-zinc-500", high: "text-amber-400", urgent: "text-red-400",
};


// ── Page ─────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newProjectId, setNewProjectId] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [cronTaskId, setCronTaskId] = useState<string | null>(null);

  const { data: tasksData, isLoading } = useQuery<{ tasks: Task[] }>({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks").then((r) => r.json()),
    refetchInterval: 10_000,
  });

  const { data: projectsData } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  // Fetch live agents from runtime; fall back to hardcoded list when gateway is offline.
  const { data: agentsData } = useQuery<{ agents: RuntimeAgent[] }>({
    queryKey: ["agents"],
    queryFn: () => fetch("/api/agents").then((r) => r.json()),
    refetchInterval: 30_000,
  });
  const agentList: RuntimeAgent[] = agentsData?.agents?.length
    ? agentsData.agents
    : KNOWN_AGENTS.map((a) => ({ agentId: a.id, name: a.name }));

  const [moveError, setMoveError] = useState<{ taskId: string; message: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: (p: { title: string; priority: string; projectId?: string; status?: string }) =>
      fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setNewTitle(""); setAddingTo(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...u }: { id: string } & Record<string, unknown>) =>
      fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  // State machine move — enforces gates, retry, chaining
  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/tasks/${id}/move`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw d; return d; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setMoveError(null); },
    onError: (err: { error: string }, vars) => setMoveError({ taskId: vars.id, message: (err as { error: string }).error }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); if (detailTaskId) setDetailTaskId(null); },
  });

  const allTasks = tasksData?.tasks ?? [];
  const projects = projectsData?.projects ?? [];

  // Stats
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats = {
    thisWeek:      allTasks.filter((t) => new Date(t.createdAt).getTime() >= weekAgo).length,
    inProgress:    allTasks.filter((t) => t.status === "in_progress").length,
    total:         allTasks.length,
    completionPct: (() => {
      const non = allTasks.filter((t) => !["archived", "promoted_to_cron"].includes(t.status)).length;
      const done = allTasks.filter((t) => t.status === "done").length;
      return non > 0 ? Math.round((done / non) * 100) : 0;
    })(),
  };

  const filtered = allTasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
    return true;
  });

  // Group tasks into kanban columns
  const statusToColumn: Record<string, string> = {
    todo:             "todo",
    in_progress:      "in_progress",
    blocked:          "in_progress",
    review:           "review",
    done:             "done",
    promoted_to_cron: "done",
    failed:           "failed",
    cancelled:        "failed",
  };
  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = filtered.filter((t) => (statusToColumn[t.status] ?? "todo") === col.key);
    return acc;
  }, {} as Record<string, Task[]>);

  const detailTask = detailTaskId ? allTasks.find((t) => t.id === detailTaskId) ?? null : null;
  const cronTask   = cronTaskId   ? allTasks.find((t) => t.id === cronTaskId)   ?? null : null;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            entity="tasks"
            data={allTasks as unknown as Record<string, unknown>[]}
            columns={["id","title","description","status","priority","assignedAgentId","projectId","dueAt","completedAt","createdAt","notes","proof"]}
          />
          <button
            onClick={() => { setAddingTo("todo"); setNewTitle(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New task
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg shrink-0">
        <StatPill label="This week"   value={stats.thisWeek}             />
        <StatPill label="In progress" value={stats.inProgress}   cls="text-blue-400"    />
        <StatPill label="Total"       value={stats.total}                />
        <StatPill label="Completion"  value={`${stats.completionPct}%`} cls="text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 shrink-0">
        <input
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-400 outline-none min-w-[140px]"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 flex-1 min-h-0">
          {COLUMNS.map((col) => {
            const colTasks = byStatus[col.key] ?? [];
            const isAdding = addingTo === col.key;

            return (
              <div key={col.key} className="flex flex-col w-72 shrink-0">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", col.dot)} />
                    <span className="text-xs font-medium text-zinc-300">{col.label}</span>
                    <span className="text-[10px] text-zinc-600 bg-zinc-800/80 px-1.5 py-0.5 rounded">{colTasks.length}</span>
                  </div>
                  <button
                    onClick={() => { setAddingTo(col.key); setNewTitle(""); setNewProjectId(""); }}
                    className="p-1 text-zinc-700 hover:text-zinc-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Inline add form */}
                {isAdding && (
                  <div className="bg-zinc-800 border border-violet-700/50 rounded-lg p-3 mb-2 space-y-2">
                    <input
                      autoFocus
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500 placeholder:text-zinc-500"
                      placeholder="Task title…"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTitle.trim())
                          createMutation.mutate({ title: newTitle.trim(), priority: newPriority, projectId: newProjectId || undefined, status: col.key });
                        if (e.key === "Escape") { setAddingTo(null); setNewTitle(""); }
                      }}
                    />
                    <div className="flex gap-2">
                      <select
                        className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none"
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                      >
                        {["low","medium","high","urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <select
                        className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none"
                        value={newProjectId}
                        onChange={(e) => setNewProjectId(e.target.value)}
                      >
                        <option value="">No project</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => newTitle.trim() && createMutation.mutate({ title: newTitle.trim(), priority: newPriority, projectId: newProjectId || undefined, status: col.key })}
                        disabled={!newTitle.trim() || createMutation.isPending}
                        className="flex-1 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded disabled:opacity-50 transition-colors"
                      >
                        Add
                      </button>
                      <button onClick={() => { setAddingTo(null); setNewTitle(""); }} className="px-2 text-zinc-600 hover:text-zinc-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Task cards */}
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {colTasks.length === 0 && !isAdding ? (
                    <div className="text-[10px] text-zinc-700 text-center py-6 border border-dashed border-zinc-800 rounded-lg">
                      No tasks
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const proj = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          project={proj ?? null}
                          moveError={moveError?.taskId === task.id ? moveError.message : null}
                          onMoveError={() => setMoveError(null)}
                          onAdvance={() => moveMutation.mutate({ id: task.id, status: NEXT_STATUS[task.status] ?? "todo" })}
                          onDelete={() => deleteMutation.mutate(task.id)}
                          onOpenDetail={() => setDetailTaskId(task.id)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail side panel */}
      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          projects={projects}
          agents={agentList}
          allTasks={allTasks}
          onClose={() => setDetailTaskId(null)}
          onUpdate={(u) => updateMutation.mutate({ id: detailTask.id, ...u })}
          onMove={(s) => moveMutation.mutate({ id: detailTask.id, status: s })}
          onDelete={() => deleteMutation.mutate(detailTask.id)}
          onPromoteToCron={() => { setCronTaskId(detailTask.id); }}
        />
      )}

      {/* Promote to Cron modal */}
      {cronTask && (
        <PromoteToCronModal
          task={cronTask}
          agents={agentList}
          onClose={() => setCronTaskId(null)}
          onSuccess={() => {
            setCronTaskId(null);
            setDetailTaskId(null);
            qc.invalidateQueries({ queryKey: ["tasks"] });
            qc.invalidateQueries({ queryKey: ["schedules"] });
          }}
        />
      )}
    </div>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────
function TaskCard({
  task, project, moveError, onMoveError, onAdvance, onDelete, onOpenDetail,
}: {
  task: Task;
  project: Project | null;
  moveError: string | null;
  onMoveError: () => void;
  onAdvance: () => void;
  onDelete: () => void;
  onOpenDetail: () => void;
}) {
  const agentColor = agentAccent(task.assignedAgentId);
  const projColor  = projectAccent(task.projectId);
  const deps: string[] = JSON.parse(task.dependencies ?? "[]");

  return (
    <div className={cn(
      "group bg-zinc-800/60 border border-zinc-700/50 rounded-lg overflow-hidden",
      "hover:border-zinc-600/60 transition-all border-l-4",
      projColor.border
    )}>
      <div className="p-3 space-y-2">
        {/* Title + actions */}
        <div className="flex items-start gap-2">
          <button
            onClick={onAdvance}
            className="mt-0.5 shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
            title={`Advance → ${NEXT_STATUS[task.status] ?? "todo"}`}
          >
            <StatusIcon status={task.status} />
          </button>
          <button
            onClick={onOpenDetail}
            className={cn(
              "text-xs text-left flex-1 leading-snug font-medium",
              task.status === "done" || task.status === "cancelled"
                ? "line-through text-zinc-600"
                : "text-zinc-100 hover:text-white"
            )}
          >
            {task.title}
          </button>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onOpenDetail} className="p-0.5 text-zinc-600 hover:text-zinc-400" title="Open details">
              <ExternalLink className="w-3 h-3" />
            </button>
            <button onClick={onDelete} className="p-0.5 text-zinc-600 hover:text-red-400" title="Delete">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Gate error */}
        {moveError && (
          <div className="ml-5 flex items-start gap-1.5 bg-red-950/40 border border-red-800/40 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-300 flex-1 leading-relaxed">{moveError}</p>
            <button onClick={onMoveError} className="text-red-700 hover:text-red-400 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Description preview */}
        {task.description && (
          <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2 ml-5">
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 ml-5 flex-wrap">
          {task.assignedAgentId && (
            <span
              className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 text-zinc-900", agentColor.avatar)}
              title={agentDisplayName(task.assignedAgentId)}
            >
              {agentInitial(task.assignedAgentId)}
            </span>
          )}
          {project && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", projColor.badge)}>
              {project.name}
            </span>
          )}
          {!["todo", "in_progress", "review", "done", "failed"].includes(task.status) && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", STATUS_CHIP[task.status] ?? STATUS_CHIP.todo)}>
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
          )}
          {deps.length > 0 && (
            <span className="text-[10px] text-zinc-600" title={`${deps.length} dependencies`}>
              <Link2 className="w-3 h-3 inline" /> {deps.length}
            </span>
          )}
          {task.requiresReview && (
            <span className="text-[10px] text-amber-600" title="Requires review before done">
              ✓ review
            </span>
          )}
          {task.linkedCronJobId && (
            <span className="text-[10px] text-violet-400" title="Linked to cron job">
              <CalendarClock className="w-3 h-3 inline" />
            </span>
          )}
          <span className={cn("text-[10px] ml-auto shrink-0", PRIORITY_COLOR[task.priority])}>
            {task.priority}
          </span>
          <span className="text-[10px] text-zinc-700 shrink-0">{timeAgo(task.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Task Detail Panel ─────────────────────────────────────────────────────────
function TaskDetailPanel({
  task, projects, agents, allTasks, onClose, onUpdate, onMove, onDelete, onPromoteToCron,
}: {
  task: Task;
  projects: Project[];
  agents: RuntimeAgent[];
  allTasks: Task[];
  onClose: () => void;
  onUpdate: (u: Record<string, unknown>) => void;
  onMove: (status: string) => void;
  onDelete: () => void;
  onPromoteToCron: () => void;
}) {
  const [title, setTitle]             = useState(task.title);
  const [desc, setDesc]               = useState(task.description ?? "");
  const [status, setStatus]           = useState(task.status);
  const [priority, setPriority]       = useState(task.priority);
  const [agentId, setAgentId]         = useState(task.assignedAgentId ?? "");
  const [projectId, setProjectId]     = useState(task.projectId ?? "");
  const [proof, setProof]             = useState(task.proof ?? "");
  const [notes, setNotes]             = useState(task.notes ?? "");
  const [dueAt, setDueAt]             = useState(task.dueAt ?? "");
  const [requiresReview, setRequiresReview] = useState(task.requiresReview ?? false);
  const [maxRetries, setMaxRetries]   = useState(task.maxRetries ?? 2);
  const [nextTitle, setNextTitle]     = useState(() => {
    try { return task.nextTaskTemplate ? JSON.parse(task.nextTaskTemplate).title ?? "" : ""; } catch { return ""; }
  });
  const [nextPriority, setNextPriority] = useState(() => {
    try { return task.nextTaskTemplate ? JSON.parse(task.nextTaskTemplate).priority ?? "medium" : "medium"; } catch { return "medium"; }
  });
  const [depSearch, setDepSearch]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [newComment, setNewComment]   = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [moveErr, setMoveErr]         = useState<string | null>(null);

  const deps: string[] = JSON.parse(task.dependencies ?? "[]");
  const depTasks = deps.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as Task[];

  const qcLocal = useQueryClient();

  interface TaskComment { id: string; taskId: string; author: string; body: string; createdAt: string; }

  const { data: commentsData, refetch: refetchComments } = useQuery<{ comments: TaskComment[] }>({
    queryKey: ["task-comments", task.id],
    queryFn: () => fetch(`/api/tasks/${task.id}/comments`).then((r) => r.json()),
  });
  const comments = commentsData?.comments ?? [];

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      setNewComment("");
      refetchComments();
    } finally {
      setPostingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    await fetch(`/api/tasks/${task.id}/comments/${commentId}`, { method: "DELETE" });
    qcLocal.invalidateQueries({ queryKey: ["task-comments", task.id] });
  }

  const accent     = agentAccent(task.assignedAgentId);
  const projColor  = projectAccent(task.projectId);

  const handleSave = async () => {
    setSaving(true);
    const nextTaskTemplate = nextTitle.trim()
      ? JSON.stringify({ title: nextTitle.trim(), priority: nextPriority })
      : null;
    await onUpdate({
      title:            title || task.title,
      description:      desc || null,
      status,
      priority,
      assignedAgentId:  agentId || null,
      projectId:        projectId || null,
      proof:            proof || null,
      notes:            notes || null,
      dueAt:            dueAt || null,
      requiresReview,
      maxRetries,
      nextTaskTemplate,
    });
    setSaving(false);
  };

  const handleMove = async (s: string) => {
    setMoveErr(null);
    try {
      await new Promise<void>((resolve, reject) => {
        const p = fetch(`/api/tasks/${task.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: s }),
        }).then(async (r) => {
          const d = await r.json();
          if (!r.ok) reject(d);
          else resolve();
        });
        void p;
      });
      onMove(s);
    } catch (e: unknown) {
      setMoveErr((e as { error?: string }).error ?? "Move failed");
    }
  };

  const canPromote = !["promoted_to_cron", "archived", "done"].includes(task.status);

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" />

      {/* Panel */}
      <div
        className="w-[420px] bg-zinc-950 border-l border-zinc-800 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-3 px-5 py-4 border-b border-zinc-800 border-l-4", projColor.border)}>
          <div className="flex-1 min-w-0">
            <input
              className="w-full text-sm font-medium text-zinc-100 bg-transparent outline-none placeholder:text-zinc-600"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
            />
            <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(task.createdAt)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors" title="Delete task">
              <X className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors">
              <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-4">

          {/* Move error */}
          {moveErr && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 flex-1">{moveErr}</p>
              <button onClick={() => setMoveErr(null)}><X className="w-3.5 h-3.5 text-red-700 hover:text-red-400" /></button>
            </div>
          )}

          {/* Quick move buttons */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Move to</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ALL_STATUSES.filter((s) => s.key !== task.status).map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleMove(s.key)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] rounded border transition-colors",
                    "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Status</label>
              <select
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ALL_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Priority</label>
              <select
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {["low","medium","high","urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Agent */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Agent</label>
            <select
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.agentId} value={a.agentId}>{a.name ?? a.agentId}</option>)}
            </select>
            {agentId && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-zinc-900", agentAccent(agentId).avatar)}>
                  {agentInitial(agentId)}
                </span>
                <span className={cn("text-[11px]", agentAccent(agentId).text)}>{agentDisplayName(agentId)}</span>
              </div>
            )}
          </div>

          {/* Project */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Project</label>
            <select
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Due date</label>
            <input
              type="datetime-local"
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Description</label>
            <textarea
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 resize-none"
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What needs to be done…"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Notes</label>
            <textarea
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, links, instructions…"
            />
          </div>

          {/* Proof */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Proof of completion</label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="URL, file path, or doc reference…"
            />
            <p className="text-[10px] text-zinc-700 mt-1">Required to mark task as Done.</p>
          </div>

          {/* State machine settings */}
          <div className="space-y-3 pt-1 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider pt-1">State machine</p>

            {/* requiresReview + maxRetries */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between bg-zinc-900/60 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs text-zinc-300">Requires review</p>
                  <p className="text-[10px] text-zinc-600">Gate before done</p>
                </div>
                <button
                  onClick={() => setRequiresReview(!requiresReview)}
                  className={cn(
                    "relative w-9 h-5 rounded-full border transition-colors shrink-0",
                    requiresReview ? "bg-amber-600 border-amber-500" : "bg-zinc-800 border-zinc-700"
                  )}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", requiresReview ? "left-4" : "left-0.5")} />
                </button>
              </div>
              <div className="bg-zinc-900/60 rounded-lg px-3 py-2">
                <p className="text-xs text-zinc-300">Max retries</p>
                <input
                  type="number"
                  min={0} max={10}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Dependencies */}
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Dependencies</label>
              {depTasks.length > 0 && (
                <div className="mt-1 space-y-1">
                  {depTasks.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 bg-zinc-900/60 rounded px-2.5 py-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_CHIP[d.status]?.includes("emerald") ? "bg-emerald-400" : "bg-zinc-500")} />
                      <span className="text-[11px] text-zinc-300 flex-1 truncate">{d.title}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", STATUS_CHIP[d.status] ?? STATUS_CHIP.todo)}>{STATUS_LABEL[d.status] ?? d.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <input
                className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-700"
                placeholder="Search tasks to add as dependency…"
                value={depSearch}
                onChange={(e) => setDepSearch(e.target.value)}
              />
              {depSearch && (
                <div className="mt-1 border border-zinc-800 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                  {allTasks
                    .filter((t) => t.id !== task.id && !deps.includes(t.id) && t.title.toLowerCase().includes(depSearch.toLowerCase()))
                    .slice(0, 5)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          const newDeps = JSON.stringify([...deps, t.id]);
                          onUpdate({ dependencies: newDeps });
                          setDepSearch("");
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors text-left"
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", "bg-zinc-500")} />
                        {t.title}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Next task template */}
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Chain: next task on completion</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-700"
                placeholder="Next task title (leave empty to disable chaining)"
                value={nextTitle}
                onChange={(e) => setNextTitle(e.target.value)}
              />
              {nextTitle && (
                <select
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none"
                  value={nextPriority}
                  onChange={(e) => setNextPriority(e.target.value)}
                >
                  {["low","medium","high","urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-zinc-900/50 rounded-lg px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Timer className="w-3 h-3 text-zinc-600" />
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Tracking</span>
            </div>
            <MetaRow label="Created"   value={new Date(task.createdAt).toLocaleString()} />
            {task.startedAt   && <MetaRow label="Started"   value={new Date(task.startedAt).toLocaleString()} />}
            {task.completedAt && <MetaRow label="Completed" value={new Date(task.completedAt).toLocaleString()} />}
            {task.failedAt    && <MetaRow label="Failed"    value={new Date(task.failedAt).toLocaleString()} />}
            {task.durationMs  != null && (
              <MetaRow label="Duration" value={
                task.durationMs < 60000
                  ? `${Math.round(task.durationMs / 1000)}s`
                  : task.durationMs < 3600000
                  ? `${Math.round(task.durationMs / 60000)}m`
                  : `${(task.durationMs / 3600000).toFixed(1)}h`
              } />
            )}
            {(task.retryCount ?? 0) > 0 && <MetaRow label="Retries" value={`${task.retryCount} / ${task.maxRetries ?? 2}`} />}
            {task.linkedCronJobId && <MetaRow label="Cron job" value={task.linkedCronJobId} mono />}
            {task.linkedSessionId && <MetaRow label="Session"  value={task.linkedSessionId} mono />}
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Comments</span>
              {comments.length > 0 && (
                <span className="text-[10px] text-zinc-700 ml-auto">{comments.length}</span>
              )}
            </div>

            {/* Comment list */}
            {comments.length > 0 && (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="group flex gap-2.5">
                    {/* Avatar */}
                    <div className={cn(
                      "w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5",
                      c.author === "user" ? "bg-zinc-700" : agentAccent(c.author).avatar
                    )}>
                      {c.author === "user"
                        ? <User className="w-3 h-3 text-zinc-400" />
                        : <Bot  className="w-3 h-3 text-zinc-900" />
                      }
                    </div>
                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(
                          "text-[10px] font-medium",
                          c.author === "user" ? "text-zinc-400" : agentAccent(c.author).text
                        )}>
                          {c.author === "user" ? "You" : c.author}
                        </span>
                        <span className="text-[10px] text-zinc-700">{timeAgo(c.createdAt)}</span>
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="ml-auto p-0.5 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {comments.length === 0 && (
              <p className="text-[10px] text-zinc-700 py-2">No comments yet.</p>
            )}

            {/* New comment input */}
            <div className="flex gap-2 pt-1">
              <textarea
                rows={2}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 resize-none placeholder:text-zinc-700"
                placeholder="Add a comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
                disabled={postingComment}
              />
              <button
                onClick={handlePostComment}
                disabled={!newComment.trim() || postingComment}
                className="self-end p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-700 disabled:opacity-40 transition-colors"
                title="Post (⌘↵)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-zinc-800 space-y-2 shrink-0">
          {canPromote && (
            <button
              onClick={onPromoteToCron}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs border border-violet-700/60 text-violet-300 hover:bg-violet-900/20 rounded-lg transition-colors"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Promote to Cron
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Promote to Cron Modal ─────────────────────────────────────────────────────
const SCHEDULE_PRESETS = [
  { label: "Every hour",    value: "0 * * * *"   },
  { label: "Daily 6 AM",   value: "0 6 * * *"   },
  { label: "Daily 9 AM",   value: "0 9 * * *"   },
  { label: "Daily midnight",value: "0 0 * * *"  },
  { label: "Mon–Fri 9 AM", value: "0 9 * * 1-5" },
  { label: "Weekly Mon",   value: "0 9 * * 1"   },
  { label: "Custom",       value: "__custom__"   },
];

function PromoteToCronModal({
  task, agents, onClose, onSuccess,
}: {
  task: Task;
  agents: RuntimeAgent[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName]               = useState(task.title);
  const [agentId, setAgentId]         = useState(task.assignedAgentId ?? agents[0]?.agentId ?? "");
  const [prompt, setPrompt]           = useState(task.description ?? "");
  const [schedulePreset, setPreset]   = useState("0 9 * * *");
  const [customCron, setCustomCron]   = useState("");
  const [outputTarget, setOutput]     = useState("");
  const [enabled, setEnabled]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const isCustom = schedulePreset === "__custom__";
  const schedule = isCustom ? customCron : schedulePreset;

  const handleCreate = async () => {
    if (!name.trim() || !agentId || !schedule.trim() || !prompt.trim()) {
      setError("Name, agent, schedule and prompt are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, name, agentId, schedule, prompt, outputTarget: outputTarget || null, enabled }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create cron job"); return; }
      onSuccess();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[480px] max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Promote to Cron</h2>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Info banner */}
          <div className="bg-violet-950/30 border border-violet-800/30 rounded-lg px-3 py-2.5 text-[11px] text-violet-300">
            This will create a scheduled cron job in OpenClaw and mark the task as <strong>Promoted to Cron</strong>. The task will no longer appear in active work.
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Cron job name</label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
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
            {agentId && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-zinc-900", agentAccent(agentId).avatar)}>
                  {agentInitial(agentId)}
                </span>
                <span className={cn("text-[11px]", agentAccent(agentId).text)}>{agentDisplayName(agentId)}</span>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Schedule</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SCHEDULE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] rounded border transition-colors",
                    schedulePreset === p.value
                      ? "bg-violet-600 text-white border-violet-500"
                      : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {isCustom && (
              <input
                className="w-full mt-2 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-300 outline-none focus:border-violet-500"
                placeholder="0 9 * * 1-5"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
              />
            )}
            {schedule && !isCustom && (
              <p className="mt-1 text-[10px] text-zinc-600 font-mono">{schedule}</p>
            )}
          </div>

          {/* Prompt */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Prompt / instruction</label>
            <textarea
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500 resize-none"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agent do each time this cron runs?"
            />
          </div>

          {/* Output target */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Output target <span className="text-zinc-700">(optional)</span></label>
            <input
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
              placeholder="e.g. discord:#general or leave empty"
              value={outputTarget}
              onChange={(e) => setOutput(e.target.value)}
            />
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-300">Enable immediately</p>
              <p className="text-[10px] text-zinc-600">Cron job will start running on schedule.</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "relative w-10 h-5 rounded-full border transition-colors",
                enabled ? "bg-violet-600 border-violet-500" : "bg-zinc-800 border-zinc-700"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                enabled ? "left-5" : "left-0.5"
              )} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-300 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || !schedule.trim() || !prompt.trim()}
            className="flex-1 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Clock className="w-3.5 h-3.5" />
            {saving ? "Creating…" : "Create cron job"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function StatPill({ label, value, cls }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className={cn("text-lg font-semibold leading-tight", cls ?? "text-zinc-100")}>{value}</span>
      <span className="text-[10px] text-zinc-500 mt-0.5">{label}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const c = "w-3.5 h-3.5";
  if (status === "done" || status === "promoted_to_cron") return <CheckCircle2 className={cn(c, "text-emerald-400")} />;
  if (status === "failed")                                return <XCircle      className={cn(c, "text-red-500")}     />;
  if (status === "blocked")                               return <AlertCircle  className={cn(c, "text-red-400")}     />;
  if (status === "in_progress" || status === "review")    return <RefreshCw    className={cn(c, "text-blue-400")}    />;
  return <Circle className={cn(c, "text-zinc-600")} />;
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-zinc-600">{label}</span>
      <span className={cn("text-[10px] text-zinc-400", mono && "font-mono")}>{value}</span>
    </div>
  );
}
