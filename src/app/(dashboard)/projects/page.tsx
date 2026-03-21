"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, Plus, X, Pencil, Check, Trash2, CheckSquare } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { projectAccent } from "@/lib/project-colors";
import { useState } from "react";

interface TaskStats {
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  taskCount: number;
  taskStats: TaskStats;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: "text-emerald-400",
  paused: "text-amber-400",
  done: "text-blue-400",
  archived: "text-zinc-600",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-400",
  paused: "bg-amber-400",
  done: "bg-blue-400",
  archived: "bg-zinc-600",
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Record<string, unknown>) =>
      fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const allProjects = data?.projects ?? [];
  const projects = search
    ? allProjects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : allProjects;
  const active = projects.filter((p) => p.status === "active");
  const rest = projects.filter((p) => p.status !== "active");

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Projects</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{allProjects.length} projects</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New project
        </button>
      </div>

      {/* Search bar */}
      <input
        className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-600"
        placeholder="Search projects…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {showCreate && (
        <div className="bg-zinc-900 border border-violet-800/50 rounded-lg p-4 space-y-3">
          <input
            autoFocus
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 placeholder:text-zinc-600"
            placeholder="Project name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || undefined });
              if (e.key === "Escape") { setShowCreate(false); setNewName(""); setNewDesc(""); }
            }}
          />
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400 outline-none focus:border-violet-500 placeholder:text-zinc-600"
            placeholder="Description (optional)…"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || undefined })}
              disabled={!newName.trim() || createMutation.isPending}
              className="px-4 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded disabled:opacity-50 transition-colors"
            >
              Create
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }} className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : allProjects.length === 0 ? (
        <div className="text-sm text-zinc-600 py-12 text-center">No projects yet. Create one to get started.</div>
      ) : projects.length === 0 ? (
        <div className="text-sm text-zinc-600 py-12 text-center">No projects match your search.</div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <Section
              title="Active"
              projects={active}
              onUpdate={(id, u) => updateMutation.mutate({ id, ...u })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
          {rest.length > 0 && (
            <Section
              title="Other"
              projects={rest}
              onUpdate={(id, u) => updateMutation.mutate({ id, ...u })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  projects,
  onUpdate,
  onDelete,
}: {
  title: string;
  projects: Project[];
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onUpdate,
  onDelete,
}: {
  project: Project;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [confirm, setConfirm] = useState(false);

  const accent  = projectAccent(project.id);
  const total   = project.taskCount;
  const done    = project.taskStats.done;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const save = () => {
    if (editName.trim() && editName !== project.name) onUpdate(project.id, { name: editName.trim() });
    setEditing(false);
  };

  return (
    <div className={cn(
      "bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors group border-l-4",
      accent.border
    )}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm text-zinc-100 outline-none focus:border-violet-500"
                />
                <button onClick={save} className="p-1 text-emerald-400 hover:text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/name">
                <Folder className={cn("w-3.5 h-3.5 shrink-0", accent.folder)} />
                <span className="text-sm font-medium text-zinc-100 truncate">{project.name}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="opacity-0 group-hover/name:opacity-100 p-0.5 text-zinc-600 hover:text-zinc-400 transition-all"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            {project.description && (
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{project.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <select
              value={project.status}
              onChange={(e) => onUpdate(project.id, { status: e.target.value })}
              className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 outline-none"
            >
              {["active", "paused", "done", "archived"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {confirm ? (
              <button onClick={() => onDelete(project.id)} className="p-1 text-red-400 hover:text-red-300">
                <Trash2 className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => setConfirm(true)}
                onBlur={() => setTimeout(() => setConfirm(false), 200)}
                className="p-1 text-zinc-700 hover:text-zinc-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Task progress */}
        {total > 0 ? (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <CheckSquare className="w-3 h-3" />
                <span>{done}/{total} tasks done</span>
              </div>
              <span className={cn("text-[10px] font-medium", accent.text)}>{progress}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", accent.progress)} style={{ width: `${progress}%` }} />
            </div>
            <div className="flex gap-3 mt-1.5">
              {project.taskStats.todo > 0 && (
                <span className="text-[10px] text-zinc-500">{project.taskStats.todo} todo</span>
              )}
              {project.taskStats.inProgress > 0 && (
                <span className="text-[10px] text-blue-400">{project.taskStats.inProgress} in progress</span>
              )}
              {project.taskStats.blocked > 0 && (
                <span className="text-[10px] text-red-400">{project.taskStats.blocked} blocked</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[10px] text-zinc-700">No tasks linked</div>
        )}
      </div>

      <div className="border-t border-zinc-800/60 px-4 py-1.5 flex items-center justify-between">
        <span className={cn("text-[10px]", STATUS_COLOR[project.status] ?? "text-zinc-500")}>{project.status}</span>
        <span className="text-[10px] text-zinc-700">{timeAgo(project.updatedAt)}</span>
      </div>
    </div>
  );
}
