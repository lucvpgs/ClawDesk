"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Activity, Cpu, RefreshCw, Crown, Plus, X,
  FileText, ChevronRight, Save, Trash2, AlertCircle,
  Package, ExternalLink, Send, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import { cn, statusDot } from "@/lib/utils";
import { agentAccent, agentInitial, agentDisplayName } from "@/lib/agent-colors";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentData {
  id: string;
  agentId: string;
  name: string | null;
  model: string | null;
  status: string | null;
  workspace: string | null;
  sessionCount: number;
  sessions: Array<{ sessionId: string; status: string | null; channel: string | null }>;
}

interface AgentConfig {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  agentDir?: string;
  model?: string;
  skills?: string[];
  identity?: { name?: string; theme?: string; emoji?: string };
  tools?: Record<string, unknown>;
  subagents?: { allowAgents?: string[] };
}

interface ConfigData {
  agents: AgentConfig[];
  availableModels: string[];
  defaultModel: string | null;
  defaultFallbacks: string[];
}

interface WorkspaceFile {
  name: string;
  path: string;
  exists: boolean;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [runAgentFor, setRunAgentFor]     = useState<AgentData | null>(null);

  const { data: runtimeData, isLoading, refetch } = useQuery<{ agents: AgentData[] }>({
    queryKey: ["agents"],
    queryFn: () => fetch("/api/agents").then((r) => r.json()),
  });

  const { data: configData, refetch: refetchConfig } = useQuery<ConfigData>({
    queryKey: ["agents-config"],
    queryFn: () => fetch("/api/agents/config").then((r) => r.json()),
  });

  const agents = runtimeData?.agents ?? [];
  const configs = configData?.agents ?? [];
  const availableModels = configData?.availableModels ?? [];
  const mainAgent   = agents.find((a) => a.status === "default");
  const subagents   = agents.filter((a) => a.status !== "default");
  const selectedAgent = selectedId ? agents.find((a) => a.agentId === selectedId) ?? null : null;
  const selectedConfig = selectedId ? configs.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Agents</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{agents.length} agents configured</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New agent
          </button>
          <button
            onClick={() => { refetch(); refetchConfig(); }}
            className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : agents.length === 0 ? (
        <div className="text-sm text-zinc-600 py-8 text-center">No agents synced.</div>
      ) : (
        <div className="space-y-6">
          {mainAgent && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Principal Agent</div>
              <AgentCard
                agent={mainAgent}
                config={configs.find((c) => c.id === mainAgent.agentId)}
                isPrincipal
                onSelect={() => setSelectedId(mainAgent.agentId)}
                selected={selectedId === mainAgent.agentId}
                onRun={() => setRunAgentFor(mainAgent)}
              />
            </div>
          )}

          {subagents.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                Subagents <span className="text-zinc-700">({subagents.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {subagents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    config={configs.find((c) => c.id === agent.agentId)}
                    isPrincipal={false}
                    onSelect={() => setSelectedId(agent.agentId)}
                    selected={selectedId === agent.agentId}
                    onRun={() => setRunAgentFor(agent)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selectedAgent && selectedConfig && (
        <AgentDetailPanel
          agent={selectedAgent}
          config={selectedConfig}
          availableModels={availableModels}
          onClose={() => setSelectedId(null)}
          onSaved={() => { refetch(); refetchConfig(); qc.invalidateQueries({ queryKey: ["agents-config"] }); }}
        />
      )}

      {/* Run agent modal */}
      {runAgentFor && (
        <RunAgentModal
          agent={runAgentFor}
          onClose={() => setRunAgentFor(null)}
        />
      )}

      {/* Create agent modal */}
      {showCreate && (
        <CreateAgentModal
          availableModels={availableModels}
          defaultModel={configData?.defaultModel ?? ""}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); refetchConfig(); }}
        />
      )}
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({
  agent, config, isPrincipal, onSelect, selected, onRun,
}: {
  agent: AgentData;
  config?: AgentConfig;
  isPrincipal: boolean;
  onSelect: () => void;
  selected: boolean;
  onRun: () => void;
}) {
  const accent = agentAccent(agent.agentId);
  const emoji  = config?.identity?.emoji ?? null;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer transition-all border-l-4",
        accent.border,
        selected ? "border-zinc-600 ring-1 ring-inset " + accent.border : "border-zinc-800 hover:border-zinc-700"
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60", isPrincipal && "py-4")}>
        {/* Avatar */}
        <span className={cn(
          "rounded-full flex items-center justify-center font-bold text-zinc-900 shrink-0",
          isPrincipal ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs",
          accent.avatar
        )}>
          {emoji ?? agentInitial(agent.agentId)}
        </span>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isPrincipal && <Crown className={cn("w-4 h-4 shrink-0", accent.text)} />}
          {!isPrincipal && <Bot className={cn("w-3.5 h-3.5 shrink-0", accent.text)} />}
          <span className={cn("font-semibold text-zinc-100 truncate", isPrincipal ? "text-base" : "text-sm")}>
            {agent.name ?? agent.agentId}
          </span>
          {isPrincipal && (
            <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", accent.badge)}>
              Principal
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:block">{agent.agentId}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className="p-1.5 rounded text-zinc-600 hover:text-violet-400 hover:bg-violet-900/20 transition-colors"
            title="Run agent"
          >
            <Send className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
        </div>
      </div>

      <div className={cn(
        "divide-x divide-zinc-800/50",
        isPrincipal ? "grid grid-cols-2 md:grid-cols-4" : "grid grid-cols-2"
      )}>
        <DetailCell icon={<Cpu className="w-3 h-3" />} label="Model" value={agent.model ?? "—"} mono />
        <DetailCell icon={<Activity className="w-3 h-3" />} label="Sessions" value={String(agent.sessionCount)} />
        {isPrincipal && (
          <>
            <DetailCell label="Workspace" value={agent.workspace ? "…" + agent.workspace.slice(-22) : "—"} mono />
            <DetailCell label="Status" value={agent.status ?? "—"} />
          </>
        )}
      </div>

      {agent.sessions.length > 0 && (
        <div className="border-t border-zinc-800/40 px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {agent.sessions.slice(0, isPrincipal ? 10 : 4).map((s, i) => (
              <div key={`${s.sessionId}-${i}`} className={cn("flex items-center gap-1.5 rounded px-2 py-0.5 border", accent.badge)}>
                <span className={cn("w-1 h-1 rounded-full", statusDot(s.status ?? ""))} />
                <span className="text-[10px] font-mono">{s.channel ?? s.sessionId.slice(0, 8)}</span>
              </div>
            ))}
            {agent.sessions.length > (isPrincipal ? 10 : 4) && (
              <span className="text-[10px] text-zinc-600 self-center">
                +{agent.sessions.length - (isPrincipal ? 10 : 4)} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Detail Panel ────────────────────────────────────────────────────────
const WORKSPACE_FILES = ["SOUL.md", "IDENTITY.md", "MEMORY.md", "HEARTBEAT.md", "BOOTSTRAP.md", "TOOLS.md", "USER.md"];

type DetailTab = "identity" | "model" | "files" | "skills";

function AgentDetailPanel({
  agent, config, availableModels, onClose, onSaved,
}: {
  agent: AgentData;
  config: AgentConfig;
  availableModels: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const accent = agentAccent(agent.agentId);
  const [tab, setTab] = useState<DetailTab>("identity");

  // Identity fields
  const [name, setName]   = useState(config.name ?? "");
  const [emoji, setEmoji] = useState(config.identity?.emoji ?? "");
  const [theme, setTheme] = useState(config.identity?.theme ?? "");

  // Model fields
  const [model, setModel] = useState(config.model ?? "");

  // Skills
  const [skills, setSkills] = useState<string[]>(config.skills ?? []);
  const [newSkill, setNewSkill] = useState("");

  // File viewer
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileEditing, setFileEditing] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Workspace files info
  const { data: agentDetail } = useQuery<{
    agent: AgentConfig;
    workspaceFiles: WorkspaceFile[];
    installedSkillDirs: string[];
  }>({
    queryKey: ["agent-detail", agent.agentId],
    queryFn: () => fetch(`/api/agents/config/${agent.agentId}`).then((r) => r.json()),
  });

  const workspaceFiles = agentDetail?.workspaceFiles ?? [];
  const installedSkillDirs = agentDetail?.installedSkillDirs ?? [];

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/agents/config/${agent.agentId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { onClose(); onSaved(); },
  });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/config/${agent.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          model: model || undefined,
          skills,
          identity: { name: name || undefined, emoji: emoji || undefined, theme: theme || undefined },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      qc.invalidateQueries({ queryKey: ["agent-detail", agent.agentId] });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function loadFile(fname: string) {
    setViewingFile(fname);
    setFileEditing(false);
    const res = await fetch(`/api/agents/config/${agent.agentId}/file?name=${fname}`);
    const data = await res.json();
    setFileContent(data.content ?? "");
  }

  async function saveFile() {
    if (!viewingFile) return;
    setFileSaving(true);
    await fetch(`/api/agents/config/${agent.agentId}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: viewingFile, content: fileContent }),
    });
    setFileSaving(false);
    setFileEditing(false);
    qc.invalidateQueries({ queryKey: ["agent-detail", agent.agentId] });
  }

  const TABS: { key: DetailTab; label: string }[] = [
    { key: "identity", label: "Identity" },
    { key: "model",    label: "Model"    },
    { key: "files",    label: "Files"    },
    { key: "skills",   label: "Skills"   },
  ];

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="w-[460px] bg-zinc-950 border-l border-zinc-800 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-3 px-5 py-4 border-b border-zinc-800 border-l-4 shrink-0", accent.border)}>
          <span className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-zinc-900 shrink-0", accent.avatar)}>
            {config.identity?.emoji ?? agentInitial(agent.agentId)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">{agent.name ?? agent.agentId}</span>
              {config.default && <span className={cn("text-[10px] px-1.5 py-0.5 rounded", accent.badge)}>Principal</span>}
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">{agent.agentId}</span>
          </div>
          {!config.default && (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors"
              title="Delete agent"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-zinc-600 hover:text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="mx-5 mt-4 bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3 shrink-0">
            <p className="text-xs text-red-300 mb-2">Delete agent <strong>{agent.agentId}</strong> from openclaw.json?</p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteMutation.mutate()}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                {deleteMutation.isPending ? "Deleting…" : "Confirm delete"}
              </button>
              <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setViewingFile(null); }}
              className={cn(
                "flex-1 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
                tab === t.key ? "text-zinc-100 border-violet-500" : "text-zinc-500 border-transparent hover:text-zinc-300"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {/* ── Identity tab ── */}
          {tab === "identity" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Display name</label>
                  <input
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Emoji</label>
                  <input
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    placeholder="🤖"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Theme / role</label>
                <input
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="e.g. coder, writer, researcher…"
                />
              </div>

              {/* Meta */}
              <div className="bg-zinc-900/50 rounded-lg px-3 py-2.5 space-y-1.5">
                <MetaRow label="Agent ID"  value={agent.agentId} mono />
                <MetaRow label="Workspace" value={config.workspace ? "…" + config.workspace.slice(-34) : "—"} mono />
                <MetaRow label="Agent dir" value={config.agentDir  ? "…" + config.agentDir.slice(-34)  : "—"} mono />
                {config.subagents?.allowAgents && (
                  <MetaRow label="Can delegate to" value={(config.subagents.allowAgents as string[]).join(", ")} />
                )}
              </div>
            </div>
          )}

          {/* ── Model tab ── */}
          {tab === "model" && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Primary model</label>
                <select
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none font-mono"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {availableModels.length === 0 && <option value={model}>{model}</option>}
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-700 mt-1">Changes write to openclaw.json and apply on next agent start.</p>
              </div>

              {/* Current model info card */}
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-4 py-3 space-y-1.5">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Active configuration</div>
                <MetaRow label="Configured model" value={config.model ?? "default"} mono />
                <MetaRow label="Runtime model"    value={agent.model  ?? "—"}        mono />
                {availableModels.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Available models</div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableModels.map((m) => (
                        <button
                          key={m}
                          onClick={() => setModel(m)}
                          className={cn(
                            "text-[10px] font-mono px-2 py-0.5 rounded border transition-colors",
                            model === m
                              ? "bg-violet-900/40 text-violet-300 border-violet-700/50"
                              : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-600"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Files tab ── */}
          {tab === "files" && (
            <div className="space-y-3">
              {!viewingFile ? (
                <>
                  <p className="text-[10px] text-zinc-600">
                    Workspace files at <code className="font-mono text-zinc-500">{config.workspace ? "…" + config.workspace.slice(-40) : "?"}</code>
                  </p>
                  <div className="space-y-1.5">
                    {(workspaceFiles.length > 0 ? workspaceFiles : WORKSPACE_FILES.map((n) => ({ name: n, path: "", exists: false }))).map((f) => (
                      <button
                        key={f.name}
                        onClick={() => f.exists && loadFile(f.name)}
                        disabled={!f.exists}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                          f.exists
                            ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700 cursor-pointer"
                            : "bg-zinc-900/40 border-zinc-800/40 opacity-40 cursor-not-allowed"
                        )}
                      >
                        <FileText className={cn("w-3.5 h-3.5 shrink-0", f.exists ? accent.text : "text-zinc-700")} />
                        <span className="text-xs text-zinc-300 font-mono">{f.name}</span>
                        {f.exists && <ExternalLink className="w-3 h-3 text-zinc-700 ml-auto" />}
                        {!f.exists && <span className="text-[10px] text-zinc-700 ml-auto">not found</span>}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setViewingFile(null)}
                      className="text-[10px] text-violet-400 hover:underline"
                    >
                      ← Back to files
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500">{viewingFile}</span>
                      {!fileEditing ? (
                        <button onClick={() => setFileEditing(true)} className="text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-2 py-0.5 rounded">
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={saveFile}
                          disabled={fileSaving}
                          className="text-[10px] text-violet-300 hover:text-violet-200 border border-violet-700 px-2 py-0.5 rounded disabled:opacity-50"
                        >
                          {fileSaving ? "Saving…" : "Save"}
                        </button>
                      )}
                    </div>
                  </div>
                  {fileEditing ? (
                    <textarea
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-xs text-zinc-300 font-mono outline-none focus:border-violet-500 resize-none"
                      rows={20}
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                    />
                  ) : (
                    <pre className="bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2.5 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap overflow-auto max-h-[400px]">
                      {fileContent || <span className="text-zinc-700">Empty file</span>}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Skills tab ── */}
          {tab === "skills" && (
            <div className="space-y-4">
              {/* Installed skills from openclaw.json */}
              <div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Installed skills</div>
                {skills.length === 0 && installedSkillDirs.length === 0 ? (
                  <div className="text-xs text-zinc-700 py-4 text-center border border-dashed border-zinc-800 rounded-lg">
                    No skills installed
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Skills from openclaw.json config */}
                    {skills.map((skillId) => (
                      <div key={skillId} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                        <Package className={cn("w-3.5 h-3.5 shrink-0", accent.text)} />
                        <span className="text-xs text-zinc-300 font-mono flex-1">{skillId}</span>
                        <button
                          onClick={() => setSkills(skills.filter((s) => s !== skillId))}
                          className="p-0.5 text-zinc-700 hover:text-red-400 transition-colors"
                          title="Remove skill"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {/* Skill dirs not in config */}
                    {installedSkillDirs
                      .filter((d) => !skills.includes(d))
                      .map((dir) => (
                        <div key={dir} className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2">
                          <Package className="w-3.5 h-3.5 shrink-0 text-zinc-600" />
                          <span className="text-xs text-zinc-500 font-mono flex-1">{dir}</span>
                          <span className="text-[10px] text-zinc-700">files only</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Add skill */}
              <div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Add skill</div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500 font-mono"
                    placeholder="skill-id or URL…"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSkill.trim()) {
                        setSkills([...skills, newSkill.trim()]);
                        setNewSkill("");
                      }
                    }}
                  />
                  <button
                    onClick={() => { if (newSkill.trim()) { setSkills([...skills, newSkill.trim()]); setNewSkill(""); } }}
                    disabled={!newSkill.trim()}
                    className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <p className="text-[10px] text-zinc-700 mt-1.5">
                  Add a skill ID (e.g. <span className="font-mono">editorial-market-writer</span>) or a URL. Save to apply.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== "files" && (
          <div className="px-5 py-4 border-t border-zinc-800 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Run Agent Modal ───────────────────────────────────────────────────────────
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
type ThinkingLevel = typeof THINKING_LEVELS[number];

function RunAgentModal({ agent, onClose }: { agent: AgentData; onClose: () => void }) {
  const accent = agentAccent(agent.agentId);
  const [message,  setMessage]  = useState("");
  const [thinking, setThinking] = useState<ThinkingLevel>("off");
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState<{ reply?: string; raw?: unknown } | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function handleRun() {
    if (!message.trim()) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.agentId, message: message.trim(), thinking }),
      });
      const data = await res.json() as { ok?: boolean; result?: unknown; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      // Extract reply text from result — openclaw agent --json shape varies
      const r = data.result as Record<string, unknown> | null;
      const reply =
        (r?.reply as string | undefined) ??
        (r?.message as string | undefined) ??
        (r?.content as string | undefined) ??
        (r?.text as string | undefined);
      setResult({ reply: reply ?? undefined, raw: r });
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[520px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800 border-l-4 rounded-tl-xl shrink-0", accent.border)}>
          <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-zinc-900 shrink-0", accent.avatar)}>
            {agent.name ? agent.name[0].toUpperCase() : agent.agentId[0].toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-zinc-100">{agent.name ?? agent.agentId}</span>
            <span className="text-[10px] text-zinc-600 font-mono ml-2">{agent.agentId}</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Prompt input */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Message</label>
            <textarea
              autoFocus
              rows={5}
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-100 outline-none focus:border-violet-500 resize-none font-mono leading-relaxed"
              placeholder="What should the agent do?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={running}
            />
            <p className="text-[10px] text-zinc-700 mt-1">⌘↵ to send · Esc to close</p>
          </div>

          {/* Thinking level */}
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Thinking</label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {THINKING_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setThinking(lvl)}
                  className={cn(
                    "text-[10px] px-2.5 py-1 rounded border transition-colors font-mono",
                    thinking === lvl
                      ? "bg-violet-900/40 text-violet-300 border-violet-700/50"
                      : "bg-zinc-900 text-zinc-600 border-zinc-800 hover:border-zinc-600"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2.5">
              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs text-red-400 break-all">{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider">Reply</span>
              </div>
              {result.reply ? (
                <pre className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-zinc-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-64 overflow-y-auto">
                  {result.reply}
                </pre>
              ) : (
                <pre className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-[10px] text-zinc-500 whitespace-pre-wrap break-all font-mono max-h-64 overflow-y-auto">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleRun}
            disabled={running || !message.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {running
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
              : <><Send className="w-3.5 h-3.5" /> Run agent</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Agent Modal ────────────────────────────────────────────────────────
function CreateAgentModal({
  availableModels, defaultModel, onClose, onCreated,
}: {
  availableModels: string[];
  defaultModel: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [id, setId]       = useState("");
  const [name, setName]   = useState("");
  const [model, setModel] = useState(defaultModel);
  const [emoji, setEmoji] = useState("");
  const [theme, setTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleCreate() {
    if (!id.trim() || !name.trim()) { setError("ID and name are required"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), name: name.trim(), model, emoji, theme }),
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
        className="relative z-10 w-[420px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">New Agent</h2>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Agent ID <span className="text-zinc-700">(unique)</span></label>
              <input
                autoFocus
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono outline-none focus:border-violet-500"
                placeholder="my-agent"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Display name</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                placeholder="My Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Emoji</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                placeholder="🤖"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Theme</label>
              <input
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
                placeholder="coder / writer / researcher"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Model</label>
            <select
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 font-mono outline-none"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <p className="text-[10px] text-zinc-700">
            Creates agent in <code className="font-mono">openclaw.json</code> and workspace directories. Run <code className="font-mono">openclaw</code> to initialize.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !id.trim() || !name.trim()}
            className="flex-1 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function DetailCell({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-1 text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wider">{icon}{label}</div>
      <div className={cn("text-xs text-zinc-300 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-zinc-600 shrink-0">{label}</span>
      <span className={cn("text-[10px] text-zinc-400 text-right truncate", mono && "font-mono")}>{value}</span>
    </div>
  );
}
