"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type CheckStatus = "ok" | "warn" | "fail" | "unknown";

interface SecurityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

interface SecurityData {
  checks: SecurityCheck[];
  score: number;
  configLoaded: boolean;
}

const STATUS_CONFIG: Record<CheckStatus, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  ok:      { icon: CheckCircle2,   color: "text-emerald-400", bg: "bg-emerald-900/10", border: "border-emerald-800/30", label: "OK"      },
  warn:    { icon: AlertTriangle,  color: "text-amber-400",   bg: "bg-amber-900/10",   border: "border-amber-800/30",   label: "Warning" },
  fail:    { icon: XCircle,        color: "text-red-400",     bg: "bg-red-900/10",     border: "border-red-800/30",     label: "Issue"   },
  unknown: { icon: HelpCircle,     color: "text-zinc-500",    bg: "bg-zinc-800/20",    border: "border-zinc-700/30",    label: "Unknown" },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const label = score >= 80 ? "Good" : score >= 50 ? "Fair" : "At Risk";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("text-4xl font-bold font-mono", color)}>{score}</div>
      <div className="text-xs text-zinc-600 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function CheckRow({ check }: { check: SecurityCheck }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[check.status];
  const Icon = cfg.icon;

  return (
    <div className={cn("border rounded-lg overflow-hidden", cfg.border)}>
      <button
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-800/30",
          cfg.bg
        )}
        onClick={() => setExpanded((p) => !p)}
      >
        <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
        <span className="flex-1 text-sm text-zinc-200">{check.label}</span>
        <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", cfg.color, cfg.border, cfg.bg)}>
          {cfg.label}
        </span>
        {(check.detail || check.fix) && (
          expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-2 border-t border-zinc-800/40">
          <p className="text-xs text-zinc-400 leading-relaxed">{check.detail}</p>
          {check.fix && (
            <div className="flex items-start gap-2 p-2.5 bg-zinc-800/40 rounded-lg">
              <span className="text-[10px] text-amber-400 font-medium shrink-0 mt-0.5">Fix →</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{check.fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const { data, isLoading, refetch } = useQuery<SecurityData>({
    queryKey: ["security"],
    queryFn: () => fetch("/api/security").then((r) => r.json()),
    staleTime: 60_000,
  });

  const checks = data?.checks ?? [];
  const score  = data?.score  ?? 0;

  const issues  = checks.filter((c) => c.status === "fail");
  const warnings = checks.filter((c) => c.status === "warn");
  const ok      = checks.filter((c) => c.status === "ok");
  const unknown = checks.filter((c) => c.status === "unknown");

  // Sort: fail first, then warn, then unknown, then ok
  const sorted = [...issues, ...warnings, ...unknown, ...ok];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Security Health</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Verificare configurație OpenClaw pentru expuneri comune
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-zinc-500">Scanning configuration…</div>
      ) : (
        <>
          {/* Score card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-5">
            <div className="flex items-center gap-8">
              <ScoreRing score={score} />
              <div className="flex-1 grid grid-cols-3 gap-3">
                {[
                  { label: "Issues",   count: issues.length,   color: "text-red-400"     },
                  { label: "Warnings", count: warnings.length, color: "text-amber-400"   },
                  { label: "Passed",   count: ok.length,       color: "text-emerald-400" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="text-center">
                    <div className={cn("text-2xl font-bold font-mono", color)}>{count}</div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Checks list */}
          <div className="space-y-2">
            {sorted.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>

          {/* Footer note */}
          <p className="text-[10px] text-zinc-700 text-center leading-relaxed">
            Aceste verificări sunt bazate pe ~/.openclaw/openclaw.json.
            Unele setări pot fi suprascrise de variabile de mediu sau flags CLI.
          </p>
        </>
      )}
    </div>
  );
}

