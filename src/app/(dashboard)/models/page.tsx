"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu, Bot, Activity, RefreshCw, Plus, Star, GitBranch,
  Trash2, ChevronRight, Check, Eye, EyeOff, X, AlertTriangle,
  Download, Loader2, CheckCircle2, XCircle, FlaskConical,
  Wrench, Copy, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDER_CATALOG, type ProviderDef, type PresetModel } from "@/lib/model-providers";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  message?: string;
}

interface FixInfo {
  type: string;
  title: string;
  message: string;
  autoFixable: boolean;
  command?: string;
  editableField?: { key: string; label: string; value: string; placeholder: string };
}

interface TestResult {
  ok: boolean;
  latencyMs: number;
  provider: string;
  modelId: string;
  checks: CheckResult[];
  fix?: FixInfo;
}

interface ConfiguredProvider {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  authType: string;
  isKnown: boolean;
  hasCredentials: boolean;
  baseUrl: string | null;
  models: string[];
}

interface ModelsConfig {
  providers: ConfiguredProvider[];
  availableModels: string[];
  primary: string | null;
  fallbacks: string[];
}

interface ModelEntry {
  model: string;
  agents: string[];
  sessionCount: number;
}

interface AgentEntry {
  agentId: string;
  name: string | null;
  model: string | null;
  sessionCount: number;
}

interface RuntimeData {
  models: ModelEntry[];
  agents: AgentEntry[];
  defaults: { model: string | null; contextTokens: number | null };
  runtimeVersion: string | null;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ModelsPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ provider: string; modelId: string } | null>(null);

  const { data: cfg, isLoading: cfgLoading, refetch: refetchCfg, isFetching: cfgFetching } =
    useQuery<ModelsConfig>({
      queryKey: ["models-config"],
      queryFn: () => fetch("/api/models/config").then((r) => r.json()),
    });

  const { data: runtime, isLoading: rtLoading } =
    useQuery<RuntimeData>({
      queryKey: ["models"],
      queryFn: () => fetch("/api/models").then((r) => r.json()),
      refetchInterval: 15_000,
    });

  const setDefaultsMutation = useMutation({
    mutationFn: (body: { primary?: string; fallbacks?: string[] }) =>
      fetch("/api/models/config/defaults", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["models-config"] }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ provider, modelId }: { provider: string; modelId: string }) =>
      fetch(`/api/models/config/${provider}/${encodeURIComponent(modelId)}`, { method: "DELETE" })
        .then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["models-config"] });
      setRemoveTarget(null);
    },
  });

  const primary = cfg?.primary ?? null;
  const fallbacks = cfg?.fallbacks ?? [];
  const providers = cfg?.providers ?? [];

  function handleSetPrimary(key: string) {
    const newFallbacks = fallbacks.filter((f) => f !== key);
    setDefaultsMutation.mutate({ primary: key, fallbacks: newFallbacks });
  }

  function handleToggleFallback(key: string) {
    const isAlready = fallbacks.includes(key);
    const newFallbacks = isAlready
      ? fallbacks.filter((f) => f !== key)
      : [...fallbacks, key];
    setDefaultsMutation.mutate({ fallbacks: newFallbacks });
  }

  const isLoading = cfgLoading || rtLoading;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Models</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {providers.length > 0
              ? `${providers.length} provider${providers.length !== 1 ? "s" : ""} · ${cfg?.availableModels.length ?? 0} model${(cfg?.availableModels.length ?? 0) !== 1 ? "s" : ""} configured`
              : "No models configured"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchCfg()}
            className={cn(
              "p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors",
              cfgFetching && "animate-spin text-violet-400"
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add model
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading…</div>
      ) : (
        <>
          {/* ── Configured providers ── */}
          {providers.length === 0 ? (
            <EmptyState onAdd={() => setAddOpen(true)} />
          ) : (
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Configured providers</div>
              {providers.map((prov) => (
                <ProviderCard
                  key={prov.id}
                  provider={prov}
                  primary={primary}
                  fallbacks={fallbacks}
                  onSetPrimary={handleSetPrimary}
                  onToggleFallback={handleToggleFallback}
                  onRemove={(modelId) => setRemoveTarget({ provider: prov.id, modelId })}
                />
              ))}
            </div>
          )}

          {/* ── Runtime stats ── */}
          {runtime && (
            <RuntimeSection runtime={runtime} />
          )}
        </>
      )}

      {/* Add model modal */}
      {addOpen && (
        <AddModelModal
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["models-config"] });
            setAddOpen(false);
          }}
          existingProviders={providers}
          currentPrimary={primary}
          currentFallbacks={fallbacks}
        />
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <ConfirmRemoveModal
          provider={removeTarget.provider}
          modelId={removeTarget.modelId}
          isPrimary={primary === `${removeTarget.provider}/${removeTarget.modelId}`}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => removeMutation.mutate(removeTarget)}
          loading={removeMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-12 text-center">
      <Cpu className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
      <p className="text-sm text-zinc-400 mb-1">No models configured</p>
      <p className="text-xs text-zinc-600 mb-4">Add a model to start using OpenClaw agents</p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add first model
      </button>
    </div>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────

function ProviderCard({
  provider, primary, fallbacks, onSetPrimary, onToggleFallback, onRemove,
}: {
  provider: ConfiguredProvider;
  primary: string | null;
  fallbacks: string[];
  onSetPrimary: (key: string) => void;
  onToggleFallback: (key: string) => void;
  onRemove: (modelId: string) => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Provider header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <span className="text-xl leading-none">{provider.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">{provider.name}</span>
            {provider.hasCredentials && (
              <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                configured
              </span>
            )}
            {!provider.hasCredentials && (
              <span className="text-[10px] bg-amber-900/30 text-amber-400 border border-amber-800/40 px-1.5 py-0.5 rounded">
                no credentials
              </span>
            )}
          </div>
          {provider.description && (
            <div className="text-[11px] text-zinc-500 mt-0.5">{provider.description}</div>
          )}
        </div>
        <div className="text-[10px] text-zinc-600">
          {provider.models.length} model{provider.models.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Models list */}
      <div className="divide-y divide-zinc-800/40">
        {provider.models.map((modelId) => {
          const key = `${provider.id}/${modelId}`;
          const isPrimary = primary === key;
          const isFallback = fallbacks.includes(key);
          return (
            <ModelRow
              key={modelId}
              modelId={modelId}
              modelKey={key}
              provider={provider.id}
              providerBaseUrl={provider.baseUrl ?? undefined}
              isPrimary={isPrimary}
              isFallback={isFallback}
              onSetPrimary={() => onSetPrimary(key)}
              onToggleFallback={() => onToggleFallback(key)}
              onRemove={() => onRemove(modelId)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Model row ─────────────────────────────────────────────────────────────────

function ModelRow({
  modelId, provider, providerBaseUrl, isPrimary, isFallback,
  onSetPrimary, onToggleFallback, onRemove,
}: {
  modelId: string;
  modelKey: string;
  provider: string;
  providerBaseUrl?: string;
  isPrimary: boolean;
  isFallback: boolean;
  onSetPrimary: () => void;
  onToggleFallback: () => void;
  onRemove: () => void;
}) {
  const [testState, setTestState] = useState<"idle" | "loading" | "done">("idle");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function runTest() {
    setTestState("loading");
    setTestResult(null);
    setFixResult(null);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, modelId }),
      });
      const data = await res.json() as TestResult;
      setTestResult(data);
    } catch {
      setTestResult({
        ok: false, latencyMs: 0, provider, modelId,
        checks: [{ id: "error", label: "Test failed", ok: false, message: "Could not reach test endpoint" }],
      });
    }
    setTestState("done");
  }

  async function runFix(type: string) {
    setFixing(true);
    setFixResult(null);
    try {
      const res = await fetch("/api/models/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json() as { ok: boolean; message: string; restarting?: boolean };
      setFixResult(data);
      if (data.ok) {
        // Re-test after a short delay to let the service restart
        setTimeout(() => runTest(), data.restarting ? 5000 : 1000);
      }
    } catch (e) {
      setFixResult({ ok: false, message: String(e) });
    }
    setFixing(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const showPanel = testState === "done" && testResult !== null;

  return (
    <div className="group">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
        <Cpu className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        <span className="text-xs font-mono text-zinc-200 flex-1 truncate">{modelId}</span>

        {/* Test status badge */}
        {testState === "loading" && (
          <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin shrink-0" />
        )}
        {testState === "done" && testResult && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border cursor-pointer",
              testResult.ok
                ? "text-emerald-400 bg-emerald-900/20 border-emerald-800/40"
                : "text-red-400 bg-red-900/20 border-red-800/40"
            )}
            onClick={() => setTestState(testState === "done" ? "idle" : "done")}
            title={testResult.ok ? "Model is healthy" : "Click to see details"}
          >
            {testResult.ok
              ? <><CheckCircle2 className="w-2.5 h-2.5" />{testResult.latencyMs}ms</>
              : <><XCircle className="w-2.5 h-2.5" />issues found</>
            }
          </span>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          {isPrimary && (
            <span className="flex items-center gap-1 text-[10px] bg-violet-900/40 text-violet-300 border border-violet-700/40 px-1.5 py-0.5 rounded">
              <Star className="w-2.5 h-2.5" />primary
            </span>
          )}
          {isFallback && !isPrimary && (
            <span className="flex items-center gap-1 text-[10px] bg-blue-900/30 text-blue-400 border border-blue-800/40 px-1.5 py-0.5 rounded">
              <GitBranch className="w-2.5 h-2.5" />fallback
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={runTest}
            disabled={testState === "loading"}
            title="Test model"
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 hover:text-amber-300 hover:bg-amber-900/20 rounded transition-colors disabled:opacity-50"
          >
            <FlaskConical className="w-3 h-3" />
            test
          </button>
          {!isPrimary && (
            <button onClick={onSetPrimary} title="Set as primary"
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 hover:text-violet-300 hover:bg-violet-900/20 rounded transition-colors">
              <Star className="w-3 h-3" />primary
            </button>
          )}
          <button onClick={onToggleFallback}
            title={isFallback ? "Remove from fallbacks" : "Add as fallback"}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors",
              isFallback
                ? "text-blue-400 hover:text-zinc-400 hover:bg-zinc-800/40"
                : "text-zinc-400 hover:text-blue-300 hover:bg-blue-900/20"
            )}>
            <GitBranch className="w-3 h-3" />{isFallback ? "unfallback" : "fallback"}
          </button>
          <button onClick={onRemove} title="Remove model"
            className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Test result panel */}
      {showPanel && testResult && (
        <div className="mx-4 mb-3 rounded-lg border border-zinc-700/50 bg-zinc-950/80 overflow-hidden">
          {/* Checks list */}
          <div className="px-3 py-2.5 space-y-1.5">
            {testResult.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2">
                {check.ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                }
                <div>
                  <span className="text-xs text-zinc-300">{check.label}</span>
                  {check.message && (
                    <p className="text-[11px] text-zinc-500 mt-0.5">{check.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Fix section */}
          {testResult.fix && !fixResult?.ok && (
            <div className="border-t border-zinc-700/50 px-3 py-3 bg-amber-950/20">
              <div className="flex items-center gap-2 mb-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-amber-300">{testResult.fix.title}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">{testResult.fix.message}</p>

              {/* Command to copy */}
              {testResult.fix.command && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5">
                    <Terminal className="w-3 h-3 text-zinc-600 shrink-0" />
                    <code className="text-[11px] text-zinc-300 font-mono flex-1">{testResult.fix.command}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(testResult.fix!.command!)}
                    className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              )}

              {/* Auto-fix button */}
              {testResult.fix.autoFixable && (
                <div className="space-y-2">
                  <button
                    onClick={() => runFix(testResult.fix!.type)}
                    disabled={fixing}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {fixing
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Applying fix…</>
                      : <><Wrench className="w-3.5 h-3.5" />Fix automatically</>
                    }
                  </button>
                  {testResult.fix.type === "ollama-daemon-env" && (
                    <p className="text-[10px] text-zinc-600">
                      This will edit the OpenClaw service configuration and restart it (~5s downtime).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fix result */}
          {fixResult && (
            <div className={cn(
              "border-t border-zinc-700/50 px-3 py-2.5 flex items-start gap-2",
              fixResult.ok ? "bg-emerald-950/30" : "bg-red-950/20"
            )}>
              {fixResult.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              }
              <div>
                <p className="text-xs text-zinc-300">{fixResult.message}</p>
                {fixResult.ok && (
                  <p className="text-[10px] text-zinc-500 mt-0.5">Re-testing in a moment…</p>
                )}
              </div>
            </div>
          )}

          {/* Close */}
          <div className="flex justify-end px-3 py-1.5 border-t border-zinc-800/60">
            <button
              onClick={() => { setTestState("idle"); setTestResult(null); setFixResult(null); }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Runtime section ───────────────────────────────────────────────────────────

function RuntimeSection({ runtime }: { runtime: RuntimeData }) {
  const { models, agents } = runtime;
  if (models.length === 0 && agents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600">Runtime usage</div>

      {/* Defaults card */}
      {(runtime.defaults.model || runtime.defaults.contextTokens) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Session defaults</div>
          <div className="flex flex-wrap gap-4">
            {runtime.defaults.model && (
              <div>
                <div className="text-[10px] text-zinc-600">Active model</div>
                <div className="text-xs font-mono text-violet-300">{runtime.defaults.model}</div>
              </div>
            )}
            {runtime.defaults.contextTokens && (
              <div>
                <div className="text-[10px] text-zinc-600">Context window</div>
                <div className="text-xs font-mono text-zinc-300">
                  {Number(runtime.defaults.contextTokens).toLocaleString()} tokens
                </div>
              </div>
            )}
            {runtime.runtimeVersion && (
              <div>
                <div className="text-[10px] text-zinc-600">Runtime version</div>
                <div className="text-xs font-mono text-zinc-300">{runtime.runtimeVersion}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* By model */}
      {models.length > 0 && (
        <div className="space-y-2">
          {models.map((m) => (
            <RuntimeModelCard key={m.model} model={m} totalAgents={agents.length} />
          ))}
        </div>
      )}

      {/* Agent table */}
      {agents.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-4 px-4 py-2 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-600">
            <div>Agent</div>
            <div className="col-span-2">Model</div>
            <div className="text-right">Sessions</div>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {agents.map((a) => (
              <div key={a.agentId} className="grid grid-cols-4 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-xs text-zinc-200 truncate">{a.name ?? a.agentId}</span>
                </div>
                <div className="col-span-2 flex items-center">
                  <span className={cn("text-xs font-mono", a.model ? "text-violet-300" : "text-zinc-600")}>
                    {a.model ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <Activity className="w-3 h-3 text-zinc-600" />
                  <span className="text-xs text-zinc-400">{a.sessionCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RuntimeModelCard({ model, totalAgents }: { model: ModelEntry; totalAgents: number }) {
  const fraction = totalAgents > 0 ? (model.agents.length / totalAgents) * 100 : 0;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/60">
        <Cpu className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        <span className="text-xs font-mono text-zinc-100 flex-1">{model.model}</span>
        <span className="text-xs text-zinc-500">
          {model.agents.length} agent{model.agents.length !== 1 ? "s" : ""} · {model.sessionCount} session{model.sessionCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Agent share</span>
          <span className="text-[10px] text-zinc-500">{Math.round(fraction)}%</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-violet-600 rounded-full" style={{ width: `${fraction}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {model.agents.map((name) => (
            <span key={name} className="flex items-center gap-1 text-[10px] bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 px-2 py-0.5 rounded">
              <Bot className="w-2.5 h-2.5 text-violet-500" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Add model modal ───────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface FormState {
  provider: ProviderDef | null;
  credentials: Record<string, string>;
  modelId: string;
  modelName: string;
  contextWindow: string;
  maxTokens: string;
  setAsPrimary: boolean;
  addAsFallback: boolean;
}

function AddModelModal({
  onClose, onSuccess, existingProviders, currentPrimary, currentFallbacks,
}: {
  onClose: () => void;
  onSuccess: () => void;
  existingProviders: ConfiguredProvider[];
  currentPrimary: string | null;
  currentFallbacks: string[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({
    provider: null,
    credentials: {},
    modelId: "",
    modelName: "",
    contextWindow: "",
    maxTokens: "",
    setAsPrimary: currentPrimary === null,
    addAsFallback: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function selectProvider(def: ProviderDef) {
    // Pre-fill defaults
    const defaults: Record<string, string> = {};
    for (const f of def.fields) {
      if (f.default) defaults[f.key] = f.default;
    }
    // If provider already has credentials configured, pre-mark creds as existing
    const existing = existingProviders.find((p) => p.id === def.id);
    setForm((f) => ({
      ...f,
      provider: def,
      credentials: defaults,
      modelId: "",
      modelName: "",
      // If already configured skip credentials step? No — show it but pre-filled
    }));
    setStep(def.fields.length === 0 ? 3 : 2); // skip step 2 if no credentials needed (e.g. openai-codex)
    setError(null);
    void existing; // suppress unused warning
  }

  function goBack() {
    if (step === 2) setStep(1);
    if (step === 3) setStep(form.provider?.fields.length === 0 ? 1 : 2);
  }

  function selectPreset(preset: PresetModel) {
    setForm((f) => ({
      ...f,
      modelId: preset.id,
      modelName: preset.name,
      contextWindow: preset.contextWindow ? String(preset.contextWindow) : "",
      maxTokens: preset.maxTokens ? String(preset.maxTokens) : "",
    }));
  }

  async function handleSubmit() {
    if (!form.provider || !form.modelId) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        provider: form.provider.id,
        modelId: form.modelId,
        modelName: form.modelName || form.modelId,
        setAsPrimary: form.setAsPrimary,
        addAsFallback: form.addAsFallback,
      };
      if (form.contextWindow) body.contextWindow = Number(form.contextWindow);
      if (form.maxTokens) body.maxTokens = Number(form.maxTokens);

      // Build providerConfig
      if (form.provider.fields.length > 0) {
        const pc: Record<string, string> = {};
        for (const f of form.provider.fields) {
          if (form.credentials[f.key]) pc[f.key] = form.credentials[f.key];
        }
        if (Object.keys(pc).length > 0) body.providerConfig = pc;
      }

      const res = await fetch("/api/models/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <div className="text-sm font-semibold text-zinc-100">Add model</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {step === 1 && "Choose provider"}
              {step === 2 && `Configure ${form.provider?.name}`}
              {step === 3 && "Select model"}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 pt-3">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium",
                step === s && "bg-violet-600 text-white",
                step > s && "bg-violet-900/40 text-violet-400",
                step < s && "bg-zinc-800 text-zinc-600",
              )}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < 3 && <div className={cn("w-8 h-px", step > s ? "bg-violet-800" : "bg-zinc-800")} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[420px] overflow-y-auto">
          {step === 1 && <Step1ProviderPicker onSelect={selectProvider} existingProviders={existingProviders} />}
          {step === 2 && form.provider && (
            <Step2Credentials
              provider={form.provider}
              credentials={form.credentials}
              onChange={(key, val) => setForm((f) => ({ ...f, credentials: { ...f.credentials, [key]: val } }))}
            />
          )}
          {step === 3 && form.provider && (
            <Step3Model
              provider={form.provider}
              form={form}
              onFieldChange={(field, val) => setForm((f) => ({ ...f, [field]: val }))}
              onSelectPreset={selectPreset}
              currentPrimary={currentPrimary}
              currentFallbacks={currentFallbacks}
            />
          )}
        </div>

        {/* Footer */}
        {step > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800">
            <button
              onClick={goBack}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              {error && <span className="text-xs text-red-400">{error}</span>}
              {step === 2 ? (
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2(form)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!form.modelId || submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors"
                >
                  {submitting ? "Adding…" : "Add model"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function canProceedStep2(form: FormState): boolean {
  if (!form.provider) return false;
  for (const f of form.provider.fields) {
    if (f.required && !form.credentials[f.key]) return false;
  }
  // custom-oauth requires completing the OAuth flow before step 3
  if (form.provider.id === "custom-oauth" && !form.credentials.accessToken) return false;
  return true;
}

// ── Step 1: Provider picker ───────────────────────────────────────────────────

function Step1ProviderPicker({
  onSelect, existingProviders,
}: {
  onSelect: (def: ProviderDef) => void;
  existingProviders: ConfiguredProvider[];
}) {
  const existingIds = new Set(existingProviders.map((p) => p.id));

  return (
    <div className="grid grid-cols-2 gap-2">
      {PROVIDER_CATALOG.map((def) => {
        const hasExisting = existingIds.has(def.id);
        return (
          <button
            key={def.id}
            onClick={() => onSelect(def)}
            className="flex items-start gap-3 p-3 bg-zinc-900 hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700 rounded-lg text-left transition-all group"
          >
            <span className="text-2xl leading-none mt-0.5">{def.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-100">{def.name}</span>
                {hasExisting && (
                  <span className="text-[9px] bg-violet-900/40 text-violet-400 px-1 py-0.5 rounded">
                    added
                  </span>
                )}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{def.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Step 2: Credentials ───────────────────────────────────────────────────────

function Step2Credentials({
  provider, credentials, onChange,
}: {
  provider: ProviderDef;
  credentials: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const [show, setShow] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
        <span className="text-2xl">{provider.icon}</span>
        <div>
          <div className="text-sm font-medium text-zinc-100">{provider.name}</div>
          <div className="text-[11px] text-zinc-500">{provider.description}</div>
        </div>
      </div>

      {provider.fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs text-zinc-400 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="relative">
            <input
              type={field.type === "password" && !show[field.key] ? "password" : "text"}
              value={credentials[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-600 pr-8"
            />
            {field.type === "password" && (
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, [field.key]: !s[field.key] }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
              >
                {show[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          {field.hint && <div className="text-[10px] text-zinc-600 mt-1">{field.hint}</div>}
        </div>
      ))}

      {provider.docsUrl && (
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
        >
          View docs →
        </a>
      )}

      {/* OAuth connect flow — only for custom-oauth */}
      {provider.id === "custom-oauth" && (
        <OAuthConnectSection
          oauthUrl={credentials.oauthUrl ?? ""}
          clientId={credentials.clientId ?? ""}
          tokenStored={!!credentials.accessToken}
          onTokenReceived={(token) => onChange("accessToken", token)}
          onClearToken={() => onChange("accessToken", "")}
        />
      )}
    </div>
  );
}

// ── OAuth connect section ─────────────────────────────────────────────────────

type OAuthPhase = "idle" | "waiting" | "done" | "error";

function OAuthConnectSection({
  oauthUrl, clientId, tokenStored,
  onTokenReceived, onClearToken,
}: {
  oauthUrl: string;
  clientId: string;
  tokenStored: boolean;
  onTokenReceived: (token: string) => void;
  onClearToken: () => void;
}) {
  const [phase, setPhase] = useState<OAuthPhase>("idle");
  const [oauthState, setOauthState] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If already have a token, show connected state
  if (tokenStored && phase !== "idle") {
    // done
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function startOAuth() {
    if (!oauthUrl) return;
    setPhase("waiting");
    setErrorMsg("");
    setGeneratedUrl(null);
    setOauthState(null);
    stopPolling();

    try {
      const res = await fetch("/api/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init", oauthUrl, clientId: clientId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);

      setGeneratedUrl(data.authUrl);
      setOauthState(data.state);

      // Open in new tab
      window.open(data.authUrl, "_blank", "noopener,noreferrer");

      // Poll for completion every 2 s
      pollRef.current = setInterval(async () => {
        try {
          const p = await fetch(`/api/oauth?state=${data.state}`).then((r) => r.json());
          if (p.done && p.token) {
            stopPolling();
            setPhase("done");
            onTokenReceived(p.token);
          }
        } catch { /* ignore poll errors */ }
      }, 2000);
    } catch (err) {
      setPhase("error");
      setErrorMsg((err as Error).message);
    }
  }

  function cancel() {
    stopPolling();
    setPhase("idle");
    setGeneratedUrl(null);
    setOauthState(null);
    void oauthState; // suppress unused warning
  }

  function submitManual() {
    const t = manualToken.trim();
    if (!t) return;
    stopPolling();
    setPhase("done");
    onTokenReceived(t);
    setShowManual(false);
  }

  const canStart = oauthUrl.startsWith("http");

  return (
    <div className="space-y-2 border-t border-zinc-800 pt-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600">OAuth authentication</div>

      {/* Connected state */}
      {tokenStored ? (
        <div className="flex items-center justify-between p-3 bg-emerald-900/20 border border-emerald-800/40 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-medium text-emerald-300">Connected</div>
              <div className="text-[10px] text-zinc-500">Access token stored — ready for Step 3</div>
            </div>
          </div>
          <button
            onClick={() => { onClearToken(); setPhase("idle"); }}
            className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : phase === "idle" ? (
        <div className="space-y-2">
          <button
            onClick={startOAuth}
            disabled={!canStart}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <span>🔐</span>
            {canStart ? "Connect — generate OAuth URL & open browser" : "Fill in OAuth Authorization URL above first"}
          </button>
          <button
            onClick={() => setShowManual((s) => !s)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {showManual ? "Hide manual entry ↑" : "Or enter access token manually ↓"}
          </button>
          {showManual && (
            <div className="flex gap-2">
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitManual()}
                placeholder="Paste access token…"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-600"
              />
              <button
                onClick={submitManual}
                disabled={!manualToken.trim()}
                className="px-3 py-1.5 text-xs text-white bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
      ) : phase === "waiting" ? (
        <div className="space-y-3">
          {/* Waiting indicator */}
          <div className="flex items-center gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-300">Waiting for authentication…</div>
              <div className="text-[10px] text-zinc-500">Complete the login in the browser tab that opened</div>
            </div>
            <button onClick={cancel} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
              Cancel
            </button>
          </div>

          {/* Generated URL — shown so user can copy if browser didn't open */}
          {generatedUrl && (
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-600">If the browser didn&apos;t open, copy this URL:</div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={generatedUrl}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-[10px] text-zinc-400 font-mono truncate focus:outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(generatedUrl)}
                  className="px-2.5 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded transition-colors"
                >
                  Copy
                </button>
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 text-[10px] text-violet-400 hover:text-violet-300 border border-zinc-800 hover:border-zinc-700 rounded transition-colors"
                >
                  Open ↗
                </a>
              </div>
            </div>
          )}

          {/* Manual fallback while waiting */}
          <button
            onClick={() => setShowManual((s) => !s)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {showManual ? "Hide manual entry ↑" : "Or paste token manually ↓"}
          </button>
          {showManual && (
            <div className="flex gap-2">
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitManual()}
                placeholder="Paste access token from redirect URL…"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-600"
              />
              <button
                onClick={submitManual}
                disabled={!manualToken.trim()}
                className="px-3 py-1.5 text-xs text-white bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
      ) : phase === "error" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-red-300">OAuth failed</div>
              <div className="text-[10px] text-zinc-500 truncate">{errorMsg}</div>
            </div>
            <button onClick={() => setPhase("idle")} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
              Retry
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Step 3: Model selection ───────────────────────────────────────────────────

function Step3Model({
  provider, form, onFieldChange, onSelectPreset, currentPrimary, currentFallbacks,
}: {
  provider: ProviderDef;
  form: FormState;
  onFieldChange: (field: keyof FormState, val: unknown) => void;
  onSelectPreset: (preset: PresetModel) => void;
  currentPrimary: string | null;
  currentFallbacks: string[];
}) {
  const noPrimary = currentPrimary === null;
  const noFallbacks = currentFallbacks.length === 0;

  return (
    <div className="space-y-4">
      {/* Preset grid */}
      {provider.presetModels.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Preset models</div>
          <div className="grid grid-cols-2 gap-1.5">
            {provider.presetModels.map((preset) => {
              const selected = form.modelId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectPreset(preset)}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-lg border text-left transition-all",
                    selected
                      ? "bg-violet-900/30 border-violet-700/60 text-violet-200"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-xs font-medium truncate flex-1">{preset.name}</span>
                    {selected && <Check className="w-3 h-3 text-violet-400 shrink-0" />}
                    {preset.reasoning && (
                      <span className="text-[9px] bg-amber-900/40 text-amber-400 px-1 py-0.5 rounded shrink-0">R</span>
                    )}
                  </div>
                  {(preset.contextWindow || preset.description) && (
                    <div className="text-[10px] text-zinc-500 mt-1">
                      {preset.description ?? (preset.contextWindow ? `${(preset.contextWindow / 1000).toFixed(0)}k ctx` : "")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom model ID */}
      {(provider.freeTextModel || provider.presetModels.length === 0) && (
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            {provider.presetModels.length > 0 ? "Or enter a custom model ID" : "Model ID"}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={form.modelId}
            onChange={(e) => {
              onFieldChange("modelId", e.target.value);
              onFieldChange("modelName", e.target.value);
            }}
            placeholder={provider.id === "ollama" ? "e.g. llama3.2:3b" : "model-id"}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-600"
          />
        </div>
      )}

      {/* Ollama pull section */}
      {provider.id === "ollama" && (
        <OllamaPullSection
          baseUrl={form.credentials.baseUrl || "http://localhost:11434"}
          onPullComplete={(modelId) => {
            onFieldChange("modelId", modelId);
            onFieldChange("modelName", modelId);
          }}
        />
      )}

      {/* Role selection */}
      <div className="space-y-2 pt-1 border-t border-zinc-800">
        <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Role</div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.setAsPrimary}
            onChange={(e) => {
              onFieldChange("setAsPrimary", e.target.checked);
              if (e.target.checked) onFieldChange("addAsFallback", false);
            }}
            className="mt-0.5 accent-violet-500"
          />
          <div>
            <div className="text-xs text-zinc-300">Set as primary model</div>
            <div className="text-[10px] text-zinc-600">
              {noPrimary ? "No primary set — recommended" : `Currently: ${currentPrimary}`}
            </div>
          </div>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.addAsFallback}
            disabled={form.setAsPrimary}
            onChange={(e) => onFieldChange("addAsFallback", e.target.checked)}
            className="mt-0.5 accent-violet-500"
          />
          <div>
            <div className={cn("text-xs", form.setAsPrimary ? "text-zinc-600" : "text-zinc-300")}>
              Add as fallback
            </div>
            <div className="text-[10px] text-zinc-600">
              {noFallbacks ? "No fallbacks set" : `${currentFallbacks.length} fallback${currentFallbacks.length !== 1 ? "s" : ""} configured`}
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

// ── Ollama pull section ───────────────────────────────────────────────────────

interface OllamaLayer {
  digest: string;
  total: number;
  completed: number;
}

type PullStatus = "idle" | "pulling" | "done" | "error";

function OllamaPullSection({
  baseUrl,
  onPullComplete,
}: {
  baseUrl: string;
  onPullComplete: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pullModel, setPullModel] = useState("");
  const [status, setStatus] = useState<PullStatus>("idle");
  const [statusText, setStatusText] = useState("");
  const [layers, setLayers] = useState<Record<string, OllamaLayer>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Aggregate progress across all layers
  const totalBytes = Object.values(layers).reduce((s, l) => s + (l.total || 0), 0);
  const completedBytes = Object.values(layers).reduce((s, l) => s + (l.completed || 0), 0);
  const pct = totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0;

  function fmt(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  const startPull = useCallback(async () => {
    if (!pullModel.trim()) return;
    abortRef.current = new AbortController();
    setStatus("pulling");
    setStatusText("Connecting…");
    setLayers({});
    setErrorMsg("");

    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, model: pullModel.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error ?? res.statusText);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line) as {
              status?: string;
              error?: string;
              digest?: string;
              total?: number;
              completed?: number;
            };
            if (obj.error) throw new Error(obj.error);
            if (obj.status) setStatusText(obj.status);
            if (obj.digest) {
              setLayers((prev) => ({
                ...prev,
                [obj.digest!]: {
                  digest: obj.digest!,
                  total: obj.total ?? prev[obj.digest!]?.total ?? 0,
                  completed: obj.completed ?? prev[obj.digest!]?.completed ?? 0,
                },
              }));
            }
            if (obj.status === "success") {
              setStatus("done");
              onPullComplete(pullModel.trim());
              return;
            }
          } catch (parseErr) {
            if ((parseErr as Error).message !== "Unexpected end of JSON input") {
              throw parseErr;
            }
          }
        }
      }
      // Stream ended without explicit "success" — treat as done
      setStatus("done");
      onPullComplete(pullModel.trim());
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        setStatusText("");
      } else {
        setStatus("error");
        setErrorMsg((err as Error).message);
      }
    }
  }, [baseUrl, pullModel, onPullComplete]);

  function cancelPull() {
    abortRef.current?.abort();
    setStatus("idle");
    setStatusText("");
    setLayers({});
  }

  if (!open) {
    return (
      <div className="border-t border-zinc-800 pt-3">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download a new model from Ollama Hub
        </button>
      </div>
    );
  }

  return (
    <div className="border border-zinc-700/60 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
          <Download className="w-3.5 h-3.5 text-violet-400" />
          Pull from Ollama Hub
        </div>
        <button
          onClick={() => { cancelPull(); setOpen(false); }}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 bg-zinc-950 space-y-3">
        {/* Input row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={pullModel}
            onChange={(e) => setPullModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && status === "idle" && startPull()}
            placeholder="e.g. llama3.2:3b, qwen3:8b, deepseek-r1:14b"
            disabled={status === "pulling"}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-600 disabled:opacity-50"
          />
          {status === "pulling" ? (
            <button
              onClick={cancelPull}
              className="px-3 py-1.5 text-xs text-red-400 border border-red-900/50 hover:bg-red-900/20 rounded transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={startPull}
              disabled={!pullModel.trim() || status === "done"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded transition-colors"
            >
              Pull
            </button>
          )}
        </div>

        {/* Progress */}
        {(status === "pulling" || status === "done" || status === "error") && (
          <div className="space-y-2">
            {/* Status line */}
            <div className="flex items-center gap-2">
              {status === "pulling" && <Loader2 className="w-3 h-3 text-violet-400 animate-spin shrink-0" />}
              {status === "done"    && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
              {status === "error"   && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
              <span className={cn(
                "text-[11px]",
                status === "done"  && "text-emerald-400",
                status === "error" && "text-red-400",
                status === "pulling" && "text-zinc-400",
              )}>
                {status === "error" ? errorMsg : statusText || "…"}
              </span>
            </div>

            {/* Byte progress bar */}
            {totalBytes > 0 && status === "pulling" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-600">
                    {fmt(completedBytes)} / {fmt(totalBytes)}
                  </span>
                  <span className="text-[10px] text-zinc-500">{pct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-600 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Done state */}
            {status === "done" && (
              <div className="flex items-center gap-2 p-2 bg-emerald-900/20 border border-emerald-800/40 rounded text-[11px] text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <span className="font-mono font-medium">{pullModel}</span> is ready — selected above.
                  Click <strong>Add model</strong> to finish.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Quick suggestions */}
        {status === "idle" && (
          <div className="flex flex-wrap gap-1">
            {["llama3.2:3b", "qwen3:8b", "mistral:7b", "deepseek-r1:14b"].map((m) => (
              <button
                key={m}
                onClick={() => setPullModel(m)}
                className="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors font-mono"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Confirm remove modal ──────────────────────────────────────────────────────

function ConfirmRemoveModal({
  provider, modelId, isPrimary, onCancel, onConfirm, loading,
}: {
  provider: string;
  modelId: string;
  isPrimary: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-zinc-100">Remove model?</div>
            <div className="text-xs text-zinc-500 mt-1 font-mono">{provider}/{modelId}</div>
            {isPrimary && (
              <div className="mt-2 text-xs text-amber-400">
                This is the primary model. Removing it will clear the primary setting.
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded transition-colors"
          >
            {loading ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
