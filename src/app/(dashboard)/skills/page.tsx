"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Plus, X, ChevronRight, Bot, Crown, ExternalLink,
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SkillsPage() {
  const qc = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "eligible" | "installed">("all");
  const [search, setSearch] = useState("");

  const { data: skillsData, isLoading: skillsLoading, refetch: refetchSkills } = useQuery<{
    skills: SkillEntry[];
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

  const allSkills = skillsData?.skills ?? [];
  const agents    = configData?.agents ?? [];

  const selectedAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) ?? null : null;
  const installedSkills = new Set(selectedAgent?.skills ?? []);

  // Auto-select principal agent on first load
  if (!selectedAgentId && agents.length > 0) {
    const principal = agents.find((a) => a.default) ?? agents[0];
    setSelectedAgentId(principal.id);
  }

  async function toggleSkill(skillName: string) {
    if (!selectedAgent) return;
    setSaving(true);
    const current = selectedAgent.skills ?? [];
    const next = installedSkills.has(skillName)
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

  const filteredSkills = allSkills.filter((s) => {
    if (filter === "eligible"  && !s.eligible)            return false;
    if (filter === "installed" && !installedSkills.has(s.name)) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())
               && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const eligibleCount   = allSkills.filter((s) => s.eligible).length;
  const installedCount  = installedSkills.size;
  const isLoading       = skillsLoading || configLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Skills</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {allSkills.length} skills in catalog · {eligibleCount} eligible on this device
          </p>
        </div>
        <button
          onClick={() => { refetchSkills(); refetchConfig(); }}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading…</div>
      ) : (
        <div className="flex gap-4">

          {/* ── Left: Agent selector ─────────────────────────────────────── */}
          <div className="w-52 shrink-0 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-1 mb-2">Agent</p>
            {agents.map((agent) => {
              const accent  = agentAccent(agent.id);
              const emoji   = agent.identity?.emoji ?? null;
              const count   = agent.skills?.length ?? 0;
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
                      {count} skill{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {selected && <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* ── Right: Skill catalog for selected agent ──────────────────── */}
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
                  <span>{installedCount} installed</span>
                </div>
              </div>
            )}

            {/* Installed skills chips */}
            {installedCount > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">Installed</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...(selectedAgent?.skills ?? [])].sort().map((skillName) => {
                    const skill = allSkills.find((s) => s.name === skillName);
                    return (
                      <div
                        key={skillName}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs",
                          skill?.eligible
                            ? "bg-emerald-900/20 border-emerald-800/40 text-emerald-300"
                            : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400"
                        )}
                      >
                        {skill?.emoji && <span>{skill.emoji}</span>}
                        <span className="font-mono">{skillName}</span>
                        <button
                          onClick={() => toggleSkill(skillName)}
                          disabled={saving}
                          className="ml-0.5 text-current opacity-60 hover:opacity-100 disabled:opacity-30 transition-opacity"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
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
                  {f}
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
                  const installed = installedSkills.has(skill.name);
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
                        installed
                          ? "bg-emerald-900/10 border-emerald-800/30"
                          : skill.eligible
                          ? "bg-zinc-900 border-zinc-800"
                          : "bg-zinc-900/50 border-zinc-800/50 opacity-70"
                      )}
                    >
                      {/* Icon / status */}
                      <div className="shrink-0 mt-0.5">
                        {installed ? (
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
                          <span className={cn("text-xs font-mono font-medium", installed ? "text-emerald-300" : skill.eligible ? "text-zinc-200" : "text-zinc-600")}>
                            {skill.name}
                          </span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded border ml-auto shrink-0",
                            skill.source === "openclaw-workspace"
                              ? "text-violet-400 border-violet-800/40 bg-violet-900/20"
                              : "text-zinc-700 border-zinc-800"
                          )}>
                            {skill.source === "openclaw-workspace" ? "local" : "bundled"}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
                          {skill.description}
                        </p>

                        {/* Missing requirements */}
                        {!skill.eligible && missingReqs.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <AlertCircle className="w-3 h-3 text-zinc-700 shrink-0" />
                            <span className="text-[10px] text-zinc-700">
                              Missing: {missingReqs.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-start gap-1.5 shrink-0">
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
                        <button
                          onClick={() => toggleSkill(skill.name)}
                          disabled={saving || !selectedAgent}
                          className={cn(
                            "p-1 rounded transition-colors disabled:opacity-40",
                            installed
                              ? "text-emerald-500 hover:text-red-400"
                              : skill.eligible
                              ? "text-zinc-600 hover:text-emerald-400"
                              : "text-zinc-800 cursor-not-allowed"
                          )}
                          title={installed ? "Remove from agent" : skill.eligible ? "Add to agent" : "Not available on this device"}
                        >
                          {installed ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>
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
