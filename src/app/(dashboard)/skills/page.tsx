"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Plus, X, ChevronRight, Bot, Crown, ExternalLink,
  Github, Loader2, Download, Trash2, FileText, Pencil, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agentAccent, agentInitial } from "@/lib/agent-colors";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SkillEntry {
  name: string;
  description: string;
  emoji?: string;
  eligible: boolean;
  disabled: boolean;
  source: string;
  bundled: boolean;
  homepage?: string;
  missing?: { bins?: string[]; anyBins?: string[]; env?: string[]; config?: string[] };
}

interface AgentConfig {
  id: string;
  name?: string;
  default?: boolean;
  skills?: string[];
  identity?: { emoji?: string };
  model?: string;
}

// ── GitHub Install Modal ───────────────────────────────────────────────────────
function GitHubInstallModal({
  agentId,
  agentName,
  onClose,
  onInstalled,
}: {
  agentId: string | null;
  agentName: string;
  onClose: () => void;
  onInstalled: (skillName: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{ skillName: string; description: string; alreadyExisted: boolean } | null>(null);
  const [error, setError] = useState("");

  async function handleInstall() {
    if (!url.trim()) return;
    setStatus("loading");
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/skills/install-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), agentId }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setResult({ skillName: data.skillName, description: data.description, alreadyExisted: data.alreadyExisted });
        onInstalled(data.skillName);
      } else {
        setStatus("error");
        setError(data.error ?? "Unknown error");
      }
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <Github className="w-4 h-4 text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100">Install skill from GitHub</h2>
            {agentId && (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Will be added to <span className="text-zinc-300">{agentName}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider">GitHub URL</label>
            <input
              autoFocus
              value={url}
              onChange={(e) => { setUrl(e.target.value); setStatus("idle"); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleInstall()}
              placeholder="https://github.com/user/my-skill"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-600 placeholder:text-zinc-600 font-mono"
            />
            <p className="text-[10px] text-zinc-600">
              Supports: repo root · /blob/branch/path/SKILL.md · /tree/branch/subdir · raw.githubusercontent.com
            </p>
          </div>
          {status === "success" && result && (
            <div className="flex items-start gap-2.5 p-3 bg-emerald-900/20 border border-emerald-800/40 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-300 font-mono">{result.skillName}</p>
                {result.description && (
                  <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{result.description}</p>
                )}
                <p className="text-[10px] text-zinc-600 mt-1">
                  {result.alreadyExisted ? "Updated existing skill file." : "Skill installed to workspace."}{agentId ? " Assigned to agent." : ""}
                </p>
              </div>
            </div>
          )}
          {status === "error" && (
            <div className="flex items-start gap-2.5 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            {status === "success" ? "Close" : "Cancel"}
          </button>
          {status !== "success" && (
            <button
              onClick={handleInstall}
              disabled={!url.trim() || status === "loading"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {status === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {status === "loading" ? "Installing…" : "Install"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skill Content Viewer Modal ────────────────────────────────────────────────
function SkillViewerModal({ skillName, onClose, onSaved }: { skillName: string; onClose: () => void; onSaved?: () => void }) {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ ok: boolean; content: string }>({
    queryKey: ["skill-content", skillName],
    queryFn: () => fetch(`/api/skills/${encodeURIComponent(skillName)}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Sync editContent when data loads
  useEffect(() => {
    if (data?.content !== undefined) setEditContent(data.content);
  }, [data?.content]);

  const raw = data?.content ?? "";
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const frontmatter = fmMatch ? fmMatch[1] : null;
  const body = fmMatch ? fmMatch[2] : raw;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Save failed");
      qc.setQueryData(["skill-content", skillName], { ok: true, content: editContent });
      qc.invalidateQueries({ queryKey: ["skills-catalog"] });
      setEditMode(false);
      onSaved?.();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setEditContent(data?.content ?? "");
    setEditMode(false);
    setSaveError(null);
  }

  const isDirty = editMode && editContent !== (data?.content ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <FileText className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="text-sm font-medium text-zinc-100 font-mono">{skillName}</span>
          <span className="text-[10px] text-zinc-600 ml-1">SKILL.md</span>
          {isDirty && <span className="text-[10px] text-amber-400">● unsaved</span>}
          <div className="ml-auto flex items-center gap-1.5">
            {editMode ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded transition-colors"
                >
                  <Save className="w-3 h-3" />
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded transition-colors"
                >
                  Discard
                </button>
              </>
            ) : (
              !isLoading && data?.ok && (
                <button
                  onClick={() => { setEditMode(true); setSaveError(null); }}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              )
            )}
            <button onClick={onClose} className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="flex items-center justify-between px-5 py-2 bg-red-950/50 border-b border-red-900/50 shrink-0">
            <span className="text-xs text-red-400">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="text-red-600 hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-zinc-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : !data?.ok ? (
            <div className="py-12 text-center text-xs text-red-400">Could not load skill content.</div>
          ) : editMode ? (
            <textarea
              className="w-full h-full min-h-[420px] px-5 py-4 text-xs text-zinc-300 font-mono bg-transparent resize-none outline-none leading-relaxed"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
              spellCheck={false}
            />
          ) : (
            <>
              {frontmatter && (
                <div className="px-5 py-3 bg-violet-950/20 border-b border-violet-900/30">
                  <p className="text-[9px] uppercase tracking-wider text-violet-600 mb-1.5">Frontmatter</p>
                  <pre className="text-[11px] text-violet-300 font-mono whitespace-pre-wrap leading-relaxed">{frontmatter}</pre>
                </div>
              )}
              <div className="px-5 py-4">
                <pre className="text-[11px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">{body.trim()}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation popover (inline) ─────────────────────────────────────
function DeleteConfirm({ skillName, onConfirm, onCancel }: { skillName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute right-0 top-7 z-20 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-3 w-56">
      <p className="text-xs text-zinc-300 mb-1">Delete <span className="font-mono text-red-300">{skillName}</span> from workspace?</p>
      <p className="text-[10px] text-zinc-600 mb-3">Removes the file from disk and unassigns from all agents.</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded transition-colors">Cancel</button>
        <button onClick={onConfirm} className="flex-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-800/60 rounded transition-colors">Delete</button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SkillsPage() {
  const qc = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "eligible" | "installed">("all");
  const [search, setSearch] = useState("");
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingSkill, setViewingSkill] = useState<string | null>(null);

  const { data: skillsData, isLoading: skillsLoading, refetch: refetchSkills } = useQuery<{
    skills: SkillEntry[];
    error?: string;
  }>({
    queryKey: ["skills-catalog"],
    queryFn: () => fetch("/api/skills").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useQuery<{
    agents: AgentConfig[];
  }>({
    queryKey: ["agents-config"],
    queryFn: () => fetch("/api/agents/config").then((r) => r.json()),
  });

  const skillsError = skillsData?.error ?? null;
  const allSkills = skillsData?.skills ?? [];
  const agents    = configData?.agents ?? [];

  const selectedAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) ?? null : null;
  const assignedSkillNames = new Set(selectedAgent?.skills ?? []);

  // All workspace skill names (on disk)
  const workspaceSkillNames = new Set(
    allSkills.filter((s) => s.source === "openclaw-workspace").map((s) => s.name)
  );

  // Auto-select principal agent on first load
  if (!selectedAgentId && agents.length > 0) {
    const principal = agents.find((a) => a.default) ?? agents[0];
    setSelectedAgentId(principal.id);
  }

  // Assign / unassign skill for current agent
  async function toggleAssign(skillName: string) {
    if (!selectedAgent) return;
    setSaving(true);
    const current = selectedAgent.skills ?? [];
    const next = assignedSkillNames.has(skillName)
      ? current.filter((s) => s !== skillName)
      : [...current, skillName];
    try {
      await fetch(`/api/agents/config/${selectedAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: next }),
      });
      qc.invalidateQueries({ queryKey: ["agents-config"] });
      refetchConfig();
    } finally {
      setSaving(false);
    }
  }

  // Delete workspace skill from disk
  async function deleteSkill(skillName: string) {
    setDeleting(true);
    try {
      await fetch(`/api/skills/${encodeURIComponent(skillName)}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["skills-catalog"] });
      qc.invalidateQueries({ queryKey: ["agents-config"] });
      refetchSkills();
      refetchConfig();
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  function handleGitHubInstalled() {
    refetchSkills();
    refetchConfig();
    qc.invalidateQueries({ queryKey: ["skills-catalog"] });
    qc.invalidateQueries({ queryKey: ["agents-config"] });
  }

  // Workspace skills not yet assigned to this agent
  const workspaceUnassigned = allSkills.filter(
    (s) => s.source === "openclaw-workspace" && !assignedSkillNames.has(s.name)
  );

  const filteredSkills = allSkills.filter((s) => {
    if (filter === "eligible"  && !s.eligible)                 return false;
    if (filter === "installed" && !assignedSkillNames.has(s.name)) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())
               && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const eligibleCount  = allSkills.filter((s) => s.eligible).length;
  const assignedCount  = assignedSkillNames.size;
  const isLoading      = skillsLoading || configLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {viewingSkill && (
        <SkillViewerModal skillName={viewingSkill} onClose={() => setViewingSkill(null)} />
      )}

      {showGitHubModal && (
        <GitHubInstallModal
          agentId={selectedAgentId}
          agentName={selectedAgent?.name ?? selectedAgent?.id ?? "selected agent"}
          onClose={() => setShowGitHubModal(false)}
          onInstalled={handleGitHubInstalled}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Skills</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {allSkills.length} in catalog · {eligibleCount} eligible · {workspaceSkillNames.size} in workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGitHubModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            Install from GitHub
          </button>
          <button
            onClick={() => { refetchSkills(); refetchConfig(); }}
            className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {skillsError && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-950/30 border border-amber-800/40 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-300">Could not load skill catalog</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Make sure OpenClaw is installed and the <span className="font-mono text-zinc-400">openclaw</span> binary is in PATH.</p>
            <p className="text-[10px] text-zinc-600 mt-1 font-mono break-all">{skillsError}</p>
          </div>
          <button onClick={() => refetchSkills()} className="shrink-0 p-1 text-zinc-600 hover:text-zinc-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading…</div>
      ) : (
        <div className="flex gap-4">

          {/* ── Left: Agent selector ─────────────────────────────────────── */}
          <div className="w-52 shrink-0 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-1 mb-2">Agent</p>
            {agents.map((agent) => {
              const accent   = agentAccent(agent.id);
              const emoji    = agent.identity?.emoji ?? null;
              const count    = agent.skills?.length ?? 0;
              const selected = selectedAgentId === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all border-l-4",
                    accent.border,
                    selected
                      ? "bg-zinc-800/60 border-zinc-700"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-900 shrink-0", accent.avatar)}>
                    {emoji ?? agentInitial(agent.id)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {agent.default && <Crown className={cn("w-2.5 h-2.5 shrink-0", accent.text)} />}
                      <span className="text-xs text-zinc-200 truncate">{agent.name ?? agent.id}</span>
                    </div>
                    <span className="text-[10px] text-zinc-600">
                      {count} assigned
                    </span>
                  </div>
                  {selected && <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* ── Right ────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Agent header */}
            {selectedAgent && (
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <Bot className={cn("w-4 h-4 shrink-0", agentAccent(selectedAgent.id).text)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-100">{selectedAgent.name ?? selectedAgent.id}</span>
                  <span className="text-[10px] text-zinc-600 font-mono ml-2">{selectedAgent.id}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <Package className="w-3 h-3" />
                  <span>{assignedCount} assigned</span>
                </div>
                <button
                  onClick={() => setShowGitHubModal(true)}
                  className="text-zinc-600 hover:text-violet-400 transition-colors ml-1"
                  title="Install skill from GitHub"
                >
                  <Github className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ── Assigned to this agent ─────────────────────────────────── */}
            {assignedCount > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">Assigned to this agent</p>
                  <span className="text-[9px] text-zinc-700">— active in agent context</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...(selectedAgent?.skills ?? [])].sort().map((skillName) => {
                    const skill = allSkills.find((s) => s.name === skillName);
                    return (
                      <div
                        key={skillName}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs group",
                          skill?.eligible
                            ? "bg-emerald-900/20 border-emerald-800/40 text-emerald-300"
                            : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400"
                        )}
                      >
                        {skill?.emoji && <span>{skill.emoji}</span>}
                        <span className="font-mono">{skillName}</span>
                        <button
                          onClick={() => toggleAssign(skillName)}
                          disabled={saving}
                          className="ml-0.5 text-current opacity-60 hover:opacity-100 disabled:opacity-30 transition-opacity"
                          title="Remove from agent (keeps skill on disk)"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-700">× removes from agent only — skill stays on disk</p>
              </div>
            )}

            {/* ── In workspace but not assigned ─────────────────────────── */}
            {workspaceUnassigned.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">In workspace — not assigned to this agent</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {workspaceUnassigned.map((skill) => (
                    <div
                      key={skill.name}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs bg-violet-900/10 border-violet-800/30 text-violet-400"
                    >
                      {skill.emoji && <span>{skill.emoji}</span>}
                      <span className="font-mono">{skill.name}</span>
                      <button
                        onClick={() => toggleAssign(skill.name)}
                        disabled={saving}
                        className="ml-0.5 opacity-60 hover:opacity-100 hover:text-emerald-400 disabled:opacity-30 transition-colors"
                        title="Assign to this agent"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-700">+ assigns to this agent · to delete from disk, use the trash icon in the catalog below</p>
              </div>
            )}

            {/* Filters + search */}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                placeholder="Search skills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {(["all", "eligible", "installed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border transition-colors capitalize",
                    filter === f
                      ? "bg-violet-900/30 border-violet-700/60 text-violet-300"
                      : "border-zinc-800 text-zinc-600 hover:text-zinc-300"
                  )}
                >
                  {f === "installed" ? "assigned" : f}
                </button>
              ))}
            </div>

            {/* Skill catalog grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredSkills.length === 0 ? (
                <div className="col-span-2 py-10 text-center text-xs text-zinc-600">
                  No skills match your filter.
                </div>
              ) : (
                filteredSkills.map((skill) => {
                  const assigned  = assignedSkillNames.has(skill.name);
                  const inWorkspace = skill.source === "openclaw-workspace";
                  const missingReqs: string[] = [
                    ...(skill.missing?.bins ?? []),
                    ...(skill.missing?.anyBins ?? []),
                    ...(skill.missing?.env ?? []).map((e) => `$${e}`),
                    ...(skill.missing?.config ?? []),
                  ];

                  return (
                    <div
                      key={skill.name}
                      className={cn(
                        "flex gap-3 p-3 rounded-lg border transition-colors",
                        assigned
                          ? "bg-emerald-900/10 border-emerald-800/30"
                          : skill.eligible
                          ? "bg-zinc-900 border-zinc-800"
                          : "bg-zinc-900/50 border-zinc-800/50 opacity-70"
                      )}
                    >
                      {/* Icon */}
                      <div className="shrink-0 mt-0.5">
                        {assigned ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : skill.eligible ? (
                          <Package className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-zinc-700" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {skill.emoji && <span className="text-sm">{skill.emoji}</span>}
                          <span className={cn("text-xs font-mono font-medium", assigned ? "text-emerald-300" : skill.eligible ? "text-zinc-200" : "text-zinc-600")}>
                            {skill.name}
                          </span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded border ml-auto shrink-0",
                            inWorkspace
                              ? "text-violet-400 border-violet-800/40 bg-violet-900/20"
                              : "text-zinc-700 border-zinc-800"
                          )}>
                            {inWorkspace ? "workspace" : "bundled"}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
                          {skill.description}
                        </p>
                        {!skill.eligible && missingReqs.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <AlertCircle className="w-3 h-3 text-zinc-700 shrink-0" />
                            <span className="text-[10px] text-zinc-700">Missing: {missingReqs.join(", ")}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-start gap-1 shrink-0 relative">
                        {skill.homepage && (
                          <a
                            href={skill.homepage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-zinc-700 hover:text-zinc-400 transition-colors"
                            title="Homepage"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        {/* Assign / unassign */}
                        <button
                          onClick={() => toggleAssign(skill.name)}
                          disabled={saving || !selectedAgent}
                          className={cn(
                            "p-1 rounded transition-colors disabled:opacity-40",
                            assigned
                              ? "text-emerald-500 hover:text-amber-400"
                              : skill.eligible
                              ? "text-zinc-600 hover:text-emerald-400"
                              : "text-zinc-800 cursor-not-allowed"
                          )}
                          title={
                            assigned
                              ? "Remove from agent (file stays on disk)"
                              : skill.eligible
                              ? "Assign to agent"
                              : "Not available on this device"
                          }
                        >
                          {assigned ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>

                        {/* View + delete — workspace skills only */}
                        {inWorkspace && (
                          <>
                            <button
                              onClick={() => setViewingSkill(skill.name)}
                              className="p-1 text-zinc-700 hover:text-violet-400 transition-colors"
                              title="View SKILL.md"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setConfirmDelete(confirmDelete === skill.name ? null : skill.name)}
                                disabled={deleting}
                                className="p-1 text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-40"
                                title="Delete from workspace (removes file from disk)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {confirmDelete === skill.name && (
                                <DeleteConfirm
                                  skillName={skill.name}
                                  onConfirm={() => deleteSkill(skill.name)}
                                  onCancel={() => setConfirmDelete(null)}
                                />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
