"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, FileText, RefreshCw, Calendar, ChevronRight,
  Save, X, Edit3, Clock, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  date: string;
  preview: string;
  wordCount: number;
  sections: string[];
  modifiedAt: string;
}

interface ListData {
  entries: JournalEntry[];
  today: string;
}

interface EntryData {
  date: string;
  content: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function relativeDate(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr + "T12:00:00");
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return formatDate(dateStr);
}

function sectionColor(section: string) {
  const s = section.toLowerCase();
  if (s.includes("complet")) return "bg-emerald-900/30 text-emerald-400 border-emerald-800/40";
  if (s.includes("resolv") || s.includes("rezolv")) return "bg-blue-900/30 text-blue-400 border-blue-800/40";
  if (s.includes("learn") || s.includes("invatat")) return "bg-amber-900/30 text-amber-400 border-amber-800/40";
  if (s.includes("decision") || s.includes("decizi")) return "bg-violet-900/30 text-violet-400 border-violet-800/40";
  return "bg-zinc-800/50 text-zinc-400 border-zinc-700/40";
}

// Simple markdown → readable text renderer (no external deps)
function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("# ")) {
      elements.push(<h1 key={key++} className="text-base font-semibold text-zinc-100 mt-4 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={key++} className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mt-5 mb-1.5 border-b border-zinc-800 pb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={key++} className="text-xs font-medium text-zinc-400 mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (/^[-*]\s/.test(line)) {
      elements.push(
        <div key={key++} className="flex items-start gap-2 py-0.5">
          <span className="text-zinc-600 mt-0.5 shrink-0">·</span>
          <span className="text-xs text-zinc-300">{line.replace(/^[-*]\s/, "")}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={key++} className="flex items-start gap-2 py-0.5">
          <span className="text-zinc-600 text-xs mt-0.5 shrink-0 w-4 text-right">{num}.</span>
          <span className="text-xs text-zinc-300">{line.replace(/^\d+\.\s/, "")}</span>
        </div>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={key++} className="border-zinc-800 my-3" />);
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1.5" />);
    } else {
      elements.push(<p key={key++} className="text-xs text-zinc-400 leading-relaxed">{line}</p>);
    }
  }

  return elements;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: list, isLoading, refetch, isFetching } = useQuery<ListData>({
    queryKey: ["memory-list"],
    queryFn: () => fetch("/api/memory").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: entry, isLoading: entryLoading } = useQuery<EntryData>({
    queryKey: ["memory-entry", selectedDate],
    queryFn: () => fetch(`/api/memory?date=${selectedDate}`).then((r) => r.json()),
    enabled: !!selectedDate,
  });

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate ?? list?.today, content }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memory-list"] });
      qc.invalidateQueries({ queryKey: ["memory-entry", selectedDate] });
      setEditing(false);
    },
  });

  const startEdit = useCallback(() => {
    setDraft(entry?.content ?? todayTemplate(list?.today ?? ""));
    setEditing(true);
  }, [entry, list?.today]);

  const openNew = useCallback(() => {
    const today = list?.today ?? "";
    setSelectedDate(today);
    setDraft(todayTemplate(today));
    setEditing(true);
  }, [list?.today]);

  const entries = list?.entries ?? [];
  const today = list?.today ?? "";
  const todayHasEntry = entries.some((e) => e.date === today);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Memory</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Agent daily journal — {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className={cn("p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors", isFetching && "animate-spin text-violet-400")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {!todayHasEntry && (
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              New entry
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Left: entry list ── */}
        <div className="w-64 shrink-0 space-y-1.5">
          {isLoading ? (
            <div className="text-xs text-zinc-600 py-8 text-center">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-lg py-10 text-center">
              <BookOpen className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No journal entries yet</p>
              <p className="text-[10px] text-zinc-700 mt-1">Your agent will write here daily</p>
            </div>
          ) : (
            entries.map((e) => (
              <EntryListItem
                key={e.date}
                entry={e}
                isToday={e.date === today}
                isSelected={selectedDate === e.date}
                onSelect={() => { setSelectedDate(e.date); setEditing(false); }}
              />
            ))
          )}
        </div>

        {/* ── Right: entry viewer / editor ── */}
        <div className="flex-1 min-w-0">
          {!selectedDate && !editing ? (
            <TodayPlaceholder
              today={today}
              hasEntry={todayHasEntry}
              onOpen={() => {
                if (todayHasEntry) {
                  setSelectedDate(today);
                } else {
                  openNew();
                }
              }}
            />
          ) : editing ? (
            <EditorPanel
              date={selectedDate ?? today}
              value={draft}
              onChange={setDraft}
              onSave={() => saveMutation.mutate(draft)}
              onCancel={() => setEditing(false)}
              saving={saveMutation.isPending}
            />
          ) : entryLoading ? (
            <div className="text-xs text-zinc-600 py-12 text-center">Loading…</div>
          ) : entry ? (
            <ViewerPanel
              entry={entry}
              onEdit={startEdit}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Entry list item ───────────────────────────────────────────────────────────

function EntryListItem({ entry, isToday, isSelected, onSelect }: {
  entry: JournalEntry;
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
        isSelected
          ? "bg-violet-900/20 border-violet-700/50"
          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {isToday && (
          <span className="text-[9px] bg-violet-900/40 text-violet-400 border border-violet-700/40 px-1 py-0.5 rounded">TODAY</span>
        )}
        <span className="text-[10px] text-zinc-500 font-mono">{entry.date}</span>
        <ChevronRight className={cn("w-3 h-3 ml-auto shrink-0 transition-colors", isSelected ? "text-violet-400" : "text-zinc-700")} />
      </div>
      {entry.preview && (
        <p className="text-[11px] text-zinc-400 truncate">{entry.preview}</p>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Hash className="w-2.5 h-2.5" />{entry.wordCount}w
        </span>
        {entry.sections.slice(0, 3).map((s) => (
          <span key={s} className={cn("text-[9px] px-1 py-0.5 rounded border", sectionColor(s))}>
            {s}
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Today placeholder ─────────────────────────────────────────────────────────

function TodayPlaceholder({ today, hasEntry, onOpen }: { today: string; hasEntry: boolean; onOpen: () => void }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
      <Calendar className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
      <div className="text-sm font-medium text-zinc-300 mb-1">
        {hasEntry ? "Today's entry" : "No entry for today yet"}
      </div>
      <div className="text-xs text-zinc-500 mb-5">{formatDate(today)}</div>
      <button
        onClick={onOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded transition-colors"
      >
        {hasEntry ? <FileText className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
        {hasEntry ? "View entry" : "Write entry"}
      </button>
    </div>
  );
}

// ── Viewer panel ──────────────────────────────────────────────────────────────

function ViewerPanel({ entry, onEdit }: { entry: EntryData; onEdit: () => void }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-zinc-200">{formatDate(entry.date)}</span>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <Edit3 className="w-3 h-3" /> Edit
        </button>
      </div>
      <div className="px-5 py-4 space-y-0.5 max-h-[600px] overflow-y-auto">
        {renderMarkdown(entry.content)}
      </div>
    </div>
  );
}

// ── Editor panel ──────────────────────────────────────────────────────────────

function EditorPanel({ date, value, onChange, onSave, onCancel, saving }: {
  date: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-zinc-200">{formatDate(date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
          >
            <Save className="w-3 h-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="p-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-xs text-zinc-300 font-mono leading-relaxed resize-none focus:outline-none p-4 min-h-[500px]"
          placeholder="Write journal entry in Markdown…"
          spellCheck={false}
        />
      </div>
      <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-1.5 text-[10px] text-zinc-600">
        <Clock className="w-3 h-3" />
        Markdown supported · Saved to ~/.openclaw/workspace/memory/{date}.md
      </div>
    </div>
  );
}

// ── Template for new entry ────────────────────────────────────────────────────

function todayTemplate(date: string) {
  return `# Journal — ${date}

## Completed
-

## Resolved
-

## Learned
-

## Decisions
-

## Notes
-
`;
}
