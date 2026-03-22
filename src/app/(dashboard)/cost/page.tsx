"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign, TrendingUp, Calendar, Zap, RefreshCw,
  Settings2, ChevronUp, ChevronDown, X, Save, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agentAccent, agentDisplayName } from "@/lib/agent-colors";

// ── Types ──────────────────────────────────────────────────────────────────────
interface CostSummary {
  today: number;
  week: number;
  month: number;
  projectedMonth: number;
  allTime: number;
}

interface AgentCost {
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface ModelCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  sessions: number;
}

interface DayCost {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}

interface CostData {
  summary: CostSummary;
  byAgent: AgentCost[];
  byModel: ModelCost[];
  byDay: DayCost[];
}

interface ModelRate {
  key: string;
  label: string;
  input: number;
  output: number;
}

interface RatesData {
  rates: ModelRate[];
  overrides: Record<string, { input: number; output: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt$(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(0)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function modelShort(model: string): string {
  return model.split("/").pop() ?? model;
}

// ── Spend card ─────────────────────────────────────────────────────────────────
function SpendCard({ label, value, sub, icon: Icon, accent }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 uppercase tracking-wider">
        <Icon className={cn("w-3 h-3", accent)} />
        {label}
      </div>
      <div className={cn("text-xl font-bold font-mono", accent)}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-600">{sub}</div>}
    </div>
  );
}

// ── Mini bar chart (SVG, no deps) ──────────────────────────────────────────────
function SparkBar({ days }: { days: DayCost[] }) {
  const max = Math.max(...days.map((d) => d.cost), 0.0001);

  return (
    <div className="w-full h-16 flex items-end gap-px">
      {days.map((d, i) => {
        const pct = (d.cost / max) * 100;
        const isToday = i === days.length - 1;
        return (
          <div key={d.date} className="flex-1 flex flex-col justify-end group relative" title={`${d.date}: ${fmt$(d.cost)}`}>
            <div
              className={cn(
                "rounded-sm transition-all",
                isToday ? "bg-violet-500" : "bg-zinc-700 group-hover:bg-zinc-500"
              )}
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Model rates modal ──────────────────────────────────────────────────────────
function RatesModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery<RatesData>({
    queryKey: ["cost-rates"],
    queryFn: () => fetch("/api/cost/rates").then((r) => r.json()),
    staleTime: 60_000,
  });

  const rates = data?.rates ?? [];
  const [editing, setEditing] = useState<{ key: string; input: string; output: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await fetch("/api/cost/rates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: editing.key,
        input: parseFloat(editing.input),
        output: parseFloat(editing.output),
      }),
    });
    qc.invalidateQueries({ queryKey: ["cost-rates"] });
    qc.invalidateQueries({ queryKey: ["cost"] });
    setSaving(false);
    setEditing(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Model Rates</h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">$ per 1M tokens — click any row to edit</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 px-4 py-2 text-[9px] uppercase tracking-wider text-zinc-600 border-b border-zinc-800/50">
            <span>Model</span>
            <span className="text-right">Input /1M</span>
            <span className="text-right">Output /1M</span>
            <span />
          </div>

          {rates.map((rate) => {
            const isEditing = editing?.key === rate.key;
            return (
              <div
                key={rate.key}
                className={cn(
                  "grid grid-cols-[1fr_80px_80px_32px] gap-2 px-4 py-2.5 border-b border-zinc-800/40 last:border-0 items-center",
                  isEditing ? "bg-zinc-800/40" : "hover:bg-zinc-800/20 cursor-pointer"
                )}
                onClick={() => !isEditing && setEditing({ key: rate.key, input: String(rate.input), output: String(rate.output) })}
              >
                <div>
                  <div className="text-xs text-zinc-300">{rate.label}</div>
                  <div className="text-[9px] text-zinc-600 font-mono">{rate.key}</div>
                </div>
                {isEditing ? (
                  <>
                    <input
                      className="bg-zinc-700 border border-zinc-600 rounded px-1.5 py-1 text-xs text-zinc-200 text-right font-mono outline-none focus:border-violet-500 w-full"
                      value={editing.input}
                      onChange={(e) => setEditing({ ...editing, input: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <input
                      className="bg-zinc-700 border border-zinc-600 rounded px-1.5 py-1 text-xs text-zinc-200 text-right font-mono outline-none focus:border-violet-500 w-full"
                      value={editing.output}
                      onChange={(e) => setEditing({ ...editing, output: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSave(); }}
                      disabled={saving}
                      className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-zinc-400 font-mono text-right">${rate.input}</div>
                    <div className="text-xs text-zinc-400 font-mono text-right">${rate.output}</div>
                    <div />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 shrink-0">
          <p className="text-[10px] text-zinc-600 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Overrides sunt salvate local în ~/.openclaw/clawdesk.json
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CostPage() {
  const [showRates, setShowRates] = useState(false);

  const { data, isLoading, refetch } = useQuery<CostData>({
    queryKey: ["cost"],
    queryFn: () => fetch("/api/cost").then((r) => r.json()),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const summary  = data?.summary;
  const byAgent  = data?.byAgent  ?? [];
  const byModel  = data?.byModel  ?? [];
  const byDay    = data?.byDay    ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {showRates && <RatesModal onClose={() => setShowRates(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Cost Tracker</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Token spend calculat din sesiunile tuturor agenților</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRates(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Model rates
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
        <div className="py-16 text-center text-sm text-zinc-500">Calculating costs…</div>
      ) : (
        <>
          {/* Spend cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SpendCard label="Today"           value={fmt$(summary?.today ?? 0)}          icon={DollarSign} accent="text-violet-400" />
            <SpendCard label="Last 7 days"     value={fmt$(summary?.week ?? 0)}            icon={Calendar}   accent="text-blue-400"   />
            <SpendCard label="Last 30 days"    value={fmt$(summary?.month ?? 0)}           icon={TrendingUp}  accent="text-emerald-400" />
            <SpendCard
              label="Projected / month"
              value={fmt$(summary?.projectedMonth ?? 0)}
              sub="based on last 7 days avg"
              icon={Zap}
              accent={(summary?.projectedMonth ?? 0) > 50 ? "text-red-400" : (summary?.projectedMonth ?? 0) > 20 ? "text-amber-400" : "text-zinc-400"}
            />
          </div>

          {/* Sparkline chart */}
          {byDay.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-600">Last 30 days</span>
                <span className="text-[10px] text-zinc-600 font-mono">{fmt$(summary?.month ?? 0)} total</span>
              </div>
              <SparkBar days={byDay} />
              <div className="flex justify-between text-[9px] text-zinc-700">
                <span>{byDay[0]?.date}</span>
                <span>today</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Agent */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800">
                <span className="text-xs font-medium text-zinc-300">By Agent</span>
              </div>
              {byAgent.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-600">No data</div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {byAgent.map((a) => {
                    const accent = agentAccent(a.agentId);
                    const maxCost = byAgent[0]?.cost ?? 1;
                    const pct = (a.cost / maxCost) * 100;
                    return (
                      <div key={a.agentId} className="px-4 py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-xs font-medium", accent.text)}>
                            {agentDisplayName(a.agentId)}
                          </span>
                          <span className="text-xs font-mono text-zinc-300">{fmt$(a.cost)}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", accent.avatar)} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                          <span>↑{fmtTokens(a.inputTokens)} ↓{fmtTokens(a.outputTokens)}</span>
                          <span>{fmtTokens(a.inputTokens + a.outputTokens)} total</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* By Model */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800">
                <span className="text-xs font-medium text-zinc-300">By Model</span>
              </div>
              {byModel.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-600">No data</div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {byModel.map((m) => {
                    const maxCost = byModel[0]?.cost ?? 1;
                    const pct = (m.cost / maxCost) * 100;
                    return (
                      <div key={m.model} className="px-4 py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-300 font-mono truncate max-w-[60%]">{modelShort(m.model)}</span>
                          <span className="text-xs font-mono text-zinc-300">{fmt$(m.cost)}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-violet-600" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                          <span>{m.sessions} session{m.sessions !== 1 ? "s" : ""}</span>
                          <span>{fmtTokens(m.inputTokens + m.outputTokens)} tokens</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* All time footer */}
          {(summary?.allTime ?? 0) > 0 && (
            <div className="text-center text-xs text-zinc-700">
              All-time spend: <span className="text-zinc-500 font-mono">{fmt$(summary?.allTime ?? 0)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
