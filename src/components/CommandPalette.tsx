"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Bot, CheckSquare, FolderKanban, CalendarClock, X, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "task" | "project" | "agent" | "schedule";
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  url: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  task:     <CheckSquare  className="w-3.5 h-3.5" />,
  project:  <FolderKanban className="w-3.5 h-3.5" />,
  agent:    <Bot          className="w-3.5 h-3.5" />,
  schedule: <CalendarClock className="w-3.5 h-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  task:     "text-amber-400",
  project:  "text-violet-400",
  agent:    "text-emerald-400",
  schedule: "text-blue-400",
};

const TYPE_LABEL: Record<string, string> = {
  task:     "Task",
  project:  "Project",
  agent:    "Agent",
  schedule: "Schedule",
};

// ── Hook: global ⌘K listener ─────────────────────────────────────────────────
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

// ── CommandPalette component ──────────────────────────────────────────────────
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json() as { results: SearchResult[] };
        setResults(data.results ?? []);
        setActiveIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  // Keyboard navigation
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" && results[activeIdx]) {
      navigate(results[activeIdx]);
    }
  }

  function navigate(result: SearchResult) {
    router.push(result.url);
    onClose();
  }

  if (!open) return null;

  // Group results by type for display
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});
  const typeOrder = ["task", "project", "agent", "schedule"] as const;

  // Flat index map for keyboard nav
  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[580px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          {loading
            ? <Loader2 className="w-4 h-4 text-zinc-600 shrink-0 animate-spin" />
            : <Search   className="w-4 h-4 text-zinc-600 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="Search tasks, projects, agents, schedules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-2 shrink-0">
            {query && (
              <button onClick={() => setQuery("")} className="p-0.5 text-zinc-700 hover:text-zinc-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="text-[10px] text-zinc-700 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {!query.trim() ? (
            <div className="py-10 text-center">
              <p className="text-xs text-zinc-600">Start typing to search…</p>
              <p className="text-[10px] text-zinc-700 mt-1">Tasks · Projects · Agents · Schedules</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-10 text-center">
              <p className="text-xs text-zinc-600">No results for <span className="text-zinc-400">"{query}"</span></p>
            </div>
          ) : (
            <div className="py-1">
              {typeOrder.map((type) => {
                const group = grouped[type];
                if (!group?.length) return null;
                return (
                  <div key={type}>
                    {/* Group header */}
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <span className={cn("w-3.5", TYPE_COLOR[type])}>{TYPE_ICON[type]}</span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                        {TYPE_LABEL[type]}s
                      </span>
                    </div>
                    {group.map((result) => {
                      const idx = flatIdx++;
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={result.id}
                          onClick={() => navigate(result)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            isActive ? "bg-zinc-800/70" : "hover:bg-zinc-900/60"
                          )}
                        >
                          <span className={cn("shrink-0", TYPE_COLOR[type])}>
                            {TYPE_ICON[type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-200 truncate">{result.title}</span>
                              {result.meta && (
                                <span className="text-[10px] text-zinc-600 font-mono shrink-0">{result.meta}</span>
                              )}
                            </div>
                            {result.subtitle && (
                              <p className="text-[10px] text-zinc-600 truncate mt-0.5">{result.subtitle}</p>
                            )}
                          </div>
                          {isActive && <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-800/60 flex items-center gap-4">
            <span className="text-[10px] text-zinc-700">{results.length} results</span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] text-zinc-700 flex items-center gap-1">
                <kbd className="font-mono bg-zinc-900 border border-zinc-800 rounded px-1">↑↓</kbd> navigate
              </span>
              <span className="text-[10px] text-zinc-700 flex items-center gap-1">
                <kbd className="font-mono bg-zinc-900 border border-zinc-800 rounded px-1">↵</kbd> open
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
