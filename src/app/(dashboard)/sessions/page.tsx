"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Bot, RefreshCw, ChevronRight, Wrench,
  ChevronDown, Terminal, User, Loader2, AlertCircle,
  Cpu, Clock, Copy, Check,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { agentAccent, agentInitial, agentDisplayName } from "@/lib/agent-colors";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SessionMeta {
  sessionId: string;
  agentId: string;
  key: string;
  updatedAt: number;
  model: string | null;
  modelProvider: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number | null;
  kind: string | null;
  abortedLastRun: boolean;
}

interface ParsedTurn {
  id: string;
  parentId: string | null;
  timestamp: string;
  role: "user" | "assistant" | "tool_result";
  text: string | null;
  toolCalls: Array<{ id: string; name: string; args: string }>;
  toolResults: Array<{ toolCallId: string; toolName: string; output: string }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function modelShort(model: string | null): string {
  if (!model) return "—";
  return model.split("/").pop() ?? model;
}

// ── Tool call / result block ───────────────────────────────────────────────────
function ToolCallBlock({ name, args }: { name: string; args: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden text-[11px]">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors text-left"
      >
        <Terminal className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="text-amber-300 font-mono font-medium">{name}</span>
        <ChevronDown className={cn("w-3 h-3 text-zinc-600 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <pre className="px-3 py-2 text-zinc-500 font-mono whitespace-pre-wrap break-all bg-zinc-900/50 leading-relaxed">
          {args || "(no args)"}
        </pre>
      )}
    </div>
  );
}

function ToolResultBlock({ toolName, output }: { toolName: string; output: string }) {
  const [open, setOpen] = useState(false);
  if (!output) return null;
  return (
    <div className="border border-zinc-800/60 rounded-lg overflow-hidden text-[11px]">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900/30 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <ChevronRight className={cn("w-3 h-3 text-zinc-600 transition-transform", open && "rotate-90")} />
        <span className="text-zinc-600 font-mono">result: {toolName}</span>
        <span className="text-zinc-700 ml-auto">{output.length > 60 ? output.slice(0, 60) + "…" : output}</span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-zinc-600 font-mono whitespace-pre-wrap break-all leading-relaxed">
          {output}
        </pre>
      )}
    </div>
  );
}

// ── Turn ──────────────────────────────────────────────────────────────────────
function TurnRow({ turn, accent }: { turn: ParsedTurn; accent: ReturnType<typeof agentAccent> }) {
  if (turn.role === "tool_result") {
    return (
      <div className="pl-10 space-y-1">
        {turn.toolResults.map((tr, i) => (
          <ToolResultBlock key={i} toolName={tr.toolName} output={tr.output} />
        ))}
      </div>
    );
  }

  const isUser = turn.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-zinc-700" : accent.avatar
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-zinc-300" />
          : <span className="text-[10px] font-bold text-white">{agentInitial(null)}</span>
        }
      </div>

      {/* Bubble */}
      <div className={cn("flex-1 min-w-0 space-y-1.5 max-w-[85%]", isUser && "items-end flex flex-col")}>
        {/* Text */}
        {turn.text && (
          <div className={cn(
            "px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap break-words",
            isUser
              ? "bg-violet-600/20 border border-violet-700/30 text-zinc-200 rounded-tr-sm"
              : "bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-sm"
          )}>
            {turn.text}
          </div>
        )}
        {/* Tool calls */}
        {turn.toolCalls.length > 0 && (
          <div className="w-full space-y-1">
            {turn.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} name={tc.name} args={tc.args} />
            ))}
          </div>
        )}
        {/* Timestamp */}
        <span className="text-[9px] text-zinc-700 px-1">
          {turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
        </span>
      </div>
    </div>
  );
}

// ── Session messages panel ────────────────────────────────────────────────────
function SessionPanel({ session, onClose }: { session: SessionMeta; onClose: () => void }) {
  const accent = agentAccent(session.agentId);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const cmd = `openclaw --session ${session.sessionId} --agent ${session.agentId}`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { data, isLoading, isError } = useQuery<{ turns: ParsedTurn[]; total: number }>({
    queryKey: ["session-messages", session.sessionId, session.agentId],
    queryFn: () =>
      fetch(`/api/sessions/${session.sessionId}?agentId=${session.agentId}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const turns = data?.turns ?? [];
  // Filter: skip pure empty turns and tool results that have no output
  const visible = turns.filter((t) =>
    t.text || t.toolCalls.length > 0 || (t.role === "tool_result" && t.toolResults.some((r) => r.output))
  );

  const pct = session.contextTokens
    ? Math.min(100, Math.round((session.totalTokens / session.contextTokens) * 100))
    : null;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className="w-[580px] bg-zinc-950 border-l border-zinc-800 h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-3 px-5 py-4 border-b border-zinc-800 shrink-0 border-l-4", accent.border)}>
          <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0", accent.avatar)}>
            {agentInitial(session.agentId)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">{agentDisplayName(session.agentId)}</span>
              {session.abortedLastRun && (
                <span className="text-[9px] px-1.5 py-0.5 bg-red-900/30 border border-red-800/50 text-red-400 rounded">aborted</span>
              )}
              {session.kind && (
                <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">{session.kind}</span>
              )}
            </div>
            <div className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate">{session.sessionId}</div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] border rounded transition-colors shrink-0 text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500"
            title="Copy CLI command to continue this session"
          >
            {copied
              ? <><Check className="w-3 h-3 text-emerald-400" /> Copied!</>
              : <><Copy className="w-3 h-3" /> Continue</>
            }
          </button>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 ml-2">
            ✕
          </button>
        </div>

        {/* Meta bar */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-zinc-800/60 bg-zinc-900/30 shrink-0 text-[10px] text-zinc-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3" />
            <span>{modelShort(session.model)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            <span>{fmtTokens(session.inputTokens)} in · {fmtTokens(session.outputTokens)} out</span>
            {pct !== null && (
              <span className={cn("ml-1", pct > 80 ? "text-amber-500" : pct > 60 ? "text-zinc-500" : "text-zinc-700")}>
                ({pct}% context)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(new Date(session.updatedAt).toISOString())}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-zinc-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading session…</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center gap-2 py-16 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Failed to load session.</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-700">No messages in this session.</div>
          ) : (
            visible.map((turn) => (
              <TurnRow key={turn.id} turn={turn} accent={accent} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<SessionMeta | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("all");

  const { data, isLoading, refetch } = useQuery<{ sessions: SessionMeta[] }>({
    queryKey: ["sessions", selectedAgentId],
    queryFn: () => fetch(`/api/sessions?agentId=${selectedAgentId}`).then((r) => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const sessions = data?.sessions ?? [];

  // Unique agent IDs from all sessions
  const agentIds = ["all", ...Array.from(new Set(sessions.map((s) => s.agentId))).sort()];

  const now = Date.now();
  const dateFiltered = sessions.filter((s) => {
    if (dateFilter === "today") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      return s.updatedAt >= startOfDay.getTime();
    }
    if (dateFilter === "week") return s.updatedAt >= now - 7 * 24 * 60 * 60 * 1000;
    return true;
  });
  const filtered = selectedAgentId === "all"
    ? dateFiltered
    : dateFiltered.filter((s) => s.agentId === selectedAgentId);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {selectedSession && (
        <SessionPanel session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Sessions</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {sessions.length} stored conversation{sessions.length !== 1 ? "s" : ""} across all agents
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-1.5">
        {(["today", "week", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize",
              dateFilter === f
                ? "bg-zinc-800 border-zinc-600 text-zinc-200"
                : "border-zinc-800 text-zinc-600 hover:text-zinc-400"
            )}
          >
            {f === "today" ? "Today" : f === "week" ? "Last 7 days" : "All time"}
          </button>
        ))}
        <span className="text-xs text-zinc-700 ml-1">{filtered.length} sessions</span>
      </div>

      {/* Agent filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {agentIds.map((id) => {
          const accent = id === "all" ? null : agentAccent(id);
          const count  = id === "all"
            ? sessions.length
            : sessions.filter((s) => s.agentId === id).length;
          return (
            <button
              key={id}
              onClick={() => setSelectedAgentId(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                selectedAgentId === id
                  ? "bg-violet-900/30 border-violet-700/60 text-violet-300"
                  : "border-zinc-800 text-zinc-600 hover:text-zinc-300"
              )}
            >
              {accent && (
                <span className={cn("w-2 h-2 rounded-full", accent.dot)} />
              )}
              {id === "all" ? "All agents" : agentDisplayName(id)}
              <span className="text-zinc-700">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Loading sessions…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-600">No sessions found.</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Agent", "Session", "Model", "Tokens", "Context", "Last active", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-zinc-600 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((session) => {
                const accent = agentAccent(session.agentId);
                const pct = session.contextTokens
                  ? Math.min(100, Math.round((session.totalTokens / session.contextTokens) * 100))
                  : null;
                return (
                  <tr
                    key={session.sessionId}
                    onClick={() => setSelectedSession(session)}
                    className={cn(
                      "cursor-pointer transition-colors border-l-4 hover:bg-zinc-800/30",
                      accent.border
                    )}
                  >
                    {/* Agent */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0", accent.avatar)}>
                          {agentInitial(session.agentId)}
                        </span>
                        <span className={cn("text-xs font-medium", accent.text)}>
                          {agentDisplayName(session.agentId)}
                        </span>
                      </div>
                    </td>

                    {/* Session ID */}
                    <td className="px-4 py-3">
                      <div className="font-mono text-[10px] text-zinc-500 truncate max-w-[120px]">
                        {session.sessionId}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {session.abortedLastRun && (
                          <span className="text-[9px] text-red-400">aborted</span>
                        )}
                        {session.kind && (
                          <span className="text-[9px] text-zinc-700">{session.kind}</span>
                        )}
                      </div>
                    </td>

                    {/* Model */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-zinc-700 shrink-0" />
                        <span className="text-[11px] text-zinc-500 font-mono">{modelShort(session.model)}</span>
                      </div>
                    </td>

                    {/* Tokens */}
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-zinc-400 font-mono">{fmtTokens(session.totalTokens)}</span>
                      <div className="text-[9px] text-zinc-700 mt-0.5">
                        ↑{fmtTokens(session.inputTokens)} ↓{fmtTokens(session.outputTokens)}
                      </div>
                    </td>

                    {/* Context % */}
                    <td className="px-4 py-3">
                      {pct !== null ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-zinc-600">{pct}%</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Last active */}
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {timeAgo(new Date(session.updatedAt).toISOString())}
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-3">
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
