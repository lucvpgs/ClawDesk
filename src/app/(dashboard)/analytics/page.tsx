"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentAccent, agentDisplayName } from "@/lib/agent-colors";
import { ProGate } from "@/components/ProGate";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DayCost {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
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

interface CostData {
  byDay: DayCost[];
  byAgent: AgentCost[];
  byModel: ModelCost[];
}

type ViewMode = "day" | "agent" | "model";

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function fmtCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function modelShort(model: string): string {
  return model.split("/").pop() ?? model;
}

// ── Summary chip ───────────────────────────────────────────────────────────────
function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</span>
      <span className="text-lg font-bold font-mono text-violet-400">{value}</span>
    </div>
  );
}

// ── SVG stacked bar chart (30-day view) ────────────────────────────────────────
function DayBarChart({ days }: { days: DayCost[] }) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, date: "", inputTokens: 0, outputTokens: 0, cost: 0,
  });
  const svgRef = useRef<SVGSVGElement>(null);

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-zinc-600">
        No data yet
      </div>
    );
  }

  const CHART_H = 200;
  const AXIS_LEFT = 40;
  const AXIS_BOTTOM = 28;
  const PADDING_TOP = 12;
  const INNER_H = CHART_H - AXIS_BOTTOM - PADDING_TOP;

  const maxTotal = Math.max(...days.map((d) => d.inputTokens + d.outputTokens), 1);

  // Y-axis scale
  function yScale(val: number): number {
    return PADDING_TOP + INNER_H - (val / maxTotal) * INNER_H;
  }

  // Y-axis tick labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: f * maxTotal,
    y: yScale(f * maxTotal),
    label: fmtTokens(Math.round(f * maxTotal)),
  }));

  const todayStr = new Date().toISOString().slice(0, 10);

  function handleMouseMove(
    e: React.MouseEvent<SVGRectElement>,
    day: DayCost,
    barX: number,
    barW: number
  ) {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = svgEl.viewBox.baseVal.width / rect.width;
    const scaleY = svgEl.viewBox.baseVal.height / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;
    setTooltip({
      visible: true,
      x: svgX,
      y: svgY,
      date: day.date,
      inputTokens: day.inputTokens,
      outputTokens: day.outputTokens,
      cost: day.cost,
    });
    void barX; void barW;
  }

  function handleMouseLeave() {
    setTooltip((t) => ({ ...t, visible: false }));
  }

  // Bar layout
  const SVG_W = 600;
  const plotW = SVG_W - AXIS_LEFT - 4;
  const gap = 1;
  const barW = Math.max(1, (plotW / days.length) - gap);

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${CHART_H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: `${CHART_H}px` }}
      >
        {/* Y-axis gridlines + labels */}
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={AXIS_LEFT}
              x2={SVG_W - 4}
              y1={tick.y}
              y2={tick.y}
              stroke="#27272a"
              strokeWidth="0.5"
            />
            <text
              x={AXIS_LEFT - 4}
              y={tick.y + 3}
              textAnchor="end"
              fontSize="7"
              fill="#52525b"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Bars */}
        {days.map((day, i) => {
          const total = day.inputTokens + day.outputTokens;
          const inputH = total > 0 ? (day.inputTokens / maxTotal) * INNER_H : 0;
          const outputH = total > 0 ? (day.outputTokens / maxTotal) * INNER_H : 0;
          const x = AXIS_LEFT + i * (barW + gap);
          const isToday = day.date === todayStr;
          const baseY = PADDING_TOP + INNER_H;

          // Input tokens — bottom of stacked bar (violet-700)
          const inputY = baseY - inputH;
          // Output tokens — on top of input (violet-400)
          const outputY = inputY - outputH;

          return (
            <g key={day.date}>
              {/* Output tokens (top, violet-400 / brighter for today) */}
              {outputH > 0 && (
                <rect
                  x={x}
                  y={outputY}
                  width={barW}
                  height={outputH}
                  fill={isToday ? "#a78bfa" : "#7c3aed"}
                  opacity={isToday ? 1 : 0.85}
                />
              )}
              {/* Input tokens (bottom, violet-700 / brighter for today) */}
              {inputH > 0 && (
                <rect
                  x={x}
                  y={inputY}
                  width={barW}
                  height={inputH}
                  fill={isToday ? "#c4b5fd" : "#5b21b6"}
                  opacity={isToday ? 1 : 0.85}
                />
              )}
              {/* Today glow */}
              {isToday && (total > 0) && (
                <rect
                  x={x - 1}
                  y={outputH > 0 ? outputY : inputY}
                  width={barW + 2}
                  height={inputH + outputH}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="1"
                  opacity="0.5"
                />
              )}
              {/* Invisible hover target */}
              <rect
                x={x}
                y={PADDING_TOP}
                width={barW}
                height={INNER_H}
                fill="transparent"
                onMouseMove={(e) => handleMouseMove(e, day, x, barW)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: "crosshair" }}
              />
            </g>
          );
        })}

        {/* X-axis baseline */}
        <line
          x1={AXIS_LEFT}
          x2={SVG_W - 4}
          y1={PADDING_TOP + INNER_H}
          y2={PADDING_TOP + INNER_H}
          stroke="#3f3f46"
          strokeWidth="0.5"
        />

        {/* X-axis date labels — every 5th */}
        {days.map((day, i) => {
          if (i % 5 !== 0 && i !== days.length - 1) return null;
          const x = AXIS_LEFT + i * (barW + gap) + barW / 2;
          const label = i === days.length - 1 ? "today" : day.date.slice(5); // MM-DD
          return (
            <text
              key={day.date}
              x={x}
              y={CHART_H - 4}
              textAnchor="middle"
              fontSize="6.5"
              fill="#52525b"
            >
              {label}
            </text>
          );
        })}

        {/* Tooltip */}
        {tooltip.visible && (() => {
          const tw = 110;
          const th = 62;
          const tx = tooltip.x + tw > SVG_W - 4 ? tooltip.x - tw - 6 : tooltip.x + 8;
          const ty = tooltip.y - th < PADDING_TOP ? tooltip.y + 6 : tooltip.y - th - 6;
          return (
            <g>
              <rect
                x={tx}
                y={ty}
                width={tw}
                height={th}
                rx="3"
                fill="#18181b"
                stroke="#3f3f46"
                strokeWidth="0.5"
              />
              <text x={tx + 6} y={ty + 12} fontSize="7" fill="#a1a1aa" fontWeight="600">
                {tooltip.date}
              </text>
              <text x={tx + 6} y={ty + 24} fontSize="7" fill="#7c3aed">
                In: {fmtTokens(tooltip.inputTokens)}
              </text>
              <text x={tx + 6} y={ty + 36} fontSize="7" fill="#a78bfa">
                Out: {fmtTokens(tooltip.outputTokens)}
              </text>
              <text x={tx + 6} y={ty + 48} fontSize="7" fill="#71717a">
                Total: {fmtTokens(tooltip.inputTokens + tooltip.outputTokens)}
              </text>
              <text x={tx + 6} y={ty + 58} fontSize="7" fill="#52525b">
                {fmtCost(tooltip.cost)}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-violet-900" />
          <span className="text-[10px] text-zinc-600">Input tokens</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-violet-600" />
          <span className="text-[10px] text-zinc-600">Output tokens</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-violet-400 ring-1 ring-violet-400/50" />
          <span className="text-[10px] text-zinc-600">Today</span>
        </div>
      </div>
    </div>
  );
}

// ── Horizontal bar (agent / model view) ───────────────────────────────────────
function HorizBars({
  items,
  labelFn,
  accentFn,
}: {
  items: Array<{ key: string; inputTokens: number; outputTokens: number; cost: number }>;
  labelFn: (key: string) => string;
  accentFn: (key: string) => string;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-zinc-600">No data yet</div>
    );
  }

  const maxTotal = Math.max(...items.map((i) => i.inputTokens + i.outputTokens), 1);

  return (
    <div className="divide-y divide-zinc-800/60">
      {items.map((item) => {
        const total = item.inputTokens + item.outputTokens;
        const pct = (total / maxTotal) * 100;
        return (
          <div key={item.key} className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn("text-xs font-medium truncate max-w-[60%]", accentFn(item.key))}>
                {labelFn(item.key)}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {fmtTokens(total)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
              <span>↑{fmtTokens(item.inputTokens)} in · ↓{fmtTokens(item.outputTokens)} out</span>
              <span>{fmtCost(item.cost)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCSV(days: DayCost[]) {
  const header = "date,inputTokens,outputTokens,totalTokens,cost";
  const rows = days.map((d) =>
    [d.date, d.inputTokens, d.outputTokens, d.inputTokens + d.outputTokens, d.cost.toFixed(6)].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clawdesk-token-analytics.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [view, setView] = useState<ViewMode>("day");

  const { data, isLoading } = useQuery<CostData>({
    queryKey: ["cost"],
    queryFn: () => fetch("/api/cost").then((r) => r.json()),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const byDay = data?.byDay ?? [];
  const byAgent = data?.byAgent ?? [];
  const byModel = data?.byModel ?? [];

  const totalInput  = byDay.reduce((s, d) => s + d.inputTokens, 0);
  const totalOutput = byDay.reduce((s, d) => s + d.outputTokens, 0);
  const totalAll    = totalInput + totalOutput;

  const agentItems = byAgent
    .map((a) => ({ key: a.agentId, inputTokens: a.inputTokens, outputTokens: a.outputTokens, cost: a.cost }))
    .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens));

  const modelItems = byModel
    .map((m) => ({ key: m.model, inputTokens: m.inputTokens, outputTokens: m.outputTokens, cost: m.cost }))
    .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <ProGate feature="Token Analytics" blur>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-400" />
              Token Analytics
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Token usage across all agents — last 30 days</p>
          </div>
          <button
            onClick={() => exportCSV(byDay)}
            disabled={byDay.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-zinc-500">Loading analytics…</div>
        ) : (
          <>
            {/* Summary chips */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryChip label="Input tokens (30d)"  value={fmtTokens(totalInput)}  />
              <SummaryChip label="Output tokens (30d)" value={fmtTokens(totalOutput)} />
              <SummaryChip label="Total tokens (30d)"  value={fmtTokens(totalAll)}    />
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
              {(["day", "agent", "model"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors capitalize",
                    view === v
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {v === "day" ? "By Day" : v === "agent" ? "By Agent" : "By Model"}
                </button>
              ))}
            </div>

            {/* Chart card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">
                  {view === "day" ? "Daily token usage — last 30 days" :
                   view === "agent" ? "Total tokens by agent" :
                   "Total tokens by model"}
                </span>
                {view === "day" && (
                  <span className="text-[10px] text-zinc-600 font-mono">
                    stacked: input + output
                  </span>
                )}
              </div>

              <div className={cn("px-4 py-3", view === "day" ? "" : "")}>
                {view === "day" && (
                  <DayBarChart days={byDay} />
                )}

                {view === "agent" && (
                  <HorizBars
                    items={agentItems}
                    labelFn={(key) => agentDisplayName(key)}
                    accentFn={(key) => agentAccent(key).text}
                  />
                )}

                {view === "model" && (
                  <HorizBars
                    items={modelItems}
                    labelFn={(key) => modelShort(key)}
                    accentFn={() => "text-violet-300"}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </ProGate>
    </div>
  );
}
