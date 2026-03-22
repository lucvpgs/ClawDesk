"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Code,
  X,
  Pencil,
  Save,
  Download,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DirEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  modifiedAt?: string;
}

interface DocsData {
  entries: DirEntry[];
  cwd: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fileIcon(name: string) {
  if (name.endsWith(".md")) return <FileText className="w-3.5 h-3.5 text-blue-400" />;
  if (name.endsWith(".json")) return <Code className="w-3.5 h-3.5 text-yellow-400" />;
  if (name.endsWith(".ts") || name.endsWith(".js")) return <Code className="w-3.5 h-3.5 text-emerald-400" />;
  return <FileText className="w-3.5 h-3.5 text-zinc-500" />;
}

export default function DocsPage() {
  const [cwd, setCwd] = useState("");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<DocsData>({
    queryKey: ["docs", cwd],
    queryFn: () => fetch(`/api/docs?path=${encodeURIComponent(cwd)}`).then((r) => r.json()),
  });

  const { data: fileData } = useQuery<{ content: string }>({
    queryKey: ["docs-file", openFile],
    queryFn: () => fetch(`/api/docs?path=${encodeURIComponent(openFile!)}&read=1`).then((r) => r.json()),
    enabled: !!openFile,
  });

  // Reset edit state when a different file is selected
  useEffect(() => {
    setEditMode(false);
    setEditContent("");
    setSaveError(null);
  }, [openFile]);

  // Sync editContent when file data loads
  useEffect(() => {
    if (fileData?.content !== undefined) {
      setEditContent(fileData.content);
    }
  }, [fileData?.content]);

  const isDirty = editMode && editContent !== (fileData?.content ?? "");

  async function handleSave() {
    if (!openFile) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: openFile, content: editContent }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Save failed");
      // Update cache so viewer shows the new content immediately
      queryClient.setQueryData(["docs-file", openFile], { content: editContent });
      setEditMode(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setEditContent(fileData?.content ?? "");
    setEditMode(false);
    setSaveError(null);
  }

  function handleDownload() {
    const content = editMode ? editContent : (fileData?.content ?? "");
    const fileName = openFile?.split("/").pop() ?? "file.txt";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const entries = data?.entries ?? [];
  const dirs = entries.filter((e) => e.type === "dir");
  const files = entries.filter((e) => e.type === "file");

  const breadcrumbs = cwd ? cwd.split("/") : [];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Workspace Docs</h1>
          <p className="text-xs text-zinc-500 mt-0.5">~/.openclaw/workspace/</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-zinc-600">
        <button
          onClick={() => setCwd("")}
          className="hover:text-zinc-300 transition-colors"
        >
          workspace
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            <button
              onClick={() => setCwd(breadcrumbs.slice(0, i + 1).join("/"))}
              className="hover:text-zinc-300 transition-colors"
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* File browser */}
        <div className={cn("md:col-span-1", openFile ? "hidden md:block" : "col-span-full")}>
          {cwd && (
            <button
              onClick={() => {
                const parts = cwd.split("/");
                setCwd(parts.slice(0, -1).join("/"));
              }}
              className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>
          )}

          {isLoading ? (
            <div className="text-sm text-zinc-500 py-4 text-center">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-zinc-600 py-4 text-center">Empty directory</div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              {dirs.map((entry, i) => (
                <button
                  key={entry.path}
                  onClick={() => setCwd(entry.path)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800/50 transition-colors text-left",
                    i > 0 && "border-t border-zinc-800/50"
                  )}
                >
                  <Folder className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-xs text-zinc-200 truncate">{entry.name}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-700 ml-auto shrink-0" />
                </button>
              ))}
              {files.map((entry, i) => (
                <button
                  key={entry.path}
                  onClick={() => setOpenFile(entry.path)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800/50 transition-colors text-left",
                    (dirs.length > 0 || i > 0) && "border-t border-zinc-800/50",
                    openFile === entry.path && "bg-zinc-800/70"
                  )}
                >
                  {fileIcon(entry.name)}
                  <span className="text-xs text-zinc-300 truncate flex-1">{entry.name}</span>
                  <span className="text-[10px] text-zinc-700 shrink-0 space-x-1.5">
                    {entry.modifiedAt && <span>{timeAgo(entry.modifiedAt)}</span>}
                    {entry.size !== undefined && <span>{formatBytes(entry.size)}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* File viewer / editor */}
        {openFile && (
          <div className="md:col-span-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {fileIcon(openFile.split("/").pop() ?? "")}
                  <span className="text-xs text-zinc-300 font-mono truncate max-w-xs">
                    {openFile.split("/").pop()}
                  </span>
                  {isDirty && (
                    <span className="text-[10px] text-amber-400 shrink-0">● unsaved</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Discard
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditMode(true); setSaveError(null); }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={handleDownload}
                    className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors"
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setOpenFile(null)}
                    className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Save error banner */}
              {saveError && (
                <div className="flex items-center justify-between px-4 py-2 bg-red-950/50 border-b border-red-900/50">
                  <span className="text-xs text-red-400">{saveError}</span>
                  <button onClick={() => setSaveError(null)} className="text-red-600 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Content area */}
              <div className="overflow-auto max-h-[60vh]">
                {editMode ? (
                  <textarea
                    className="w-full h-full min-h-[400px] px-4 py-3 text-xs text-zinc-300 font-mono bg-transparent resize-none outline-none leading-relaxed"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                    spellCheck={false}
                  />
                ) : (
                  <pre className="px-4 py-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {fileData?.content ?? "Loading…"}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
