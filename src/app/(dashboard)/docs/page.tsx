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
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const [extFilter, setExtFilter] = useState<string | null>(null);
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

  // Reset ext filter when navigating to a new directory
  useEffect(() => {
    setExtFilter(null);
  }, [cwd]);

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
  const allFiles = entries.filter((e) => e.type === "file");

  // Unique extensions in current directory
  const allExts = Array.from(new Set(
    allFiles.map((f) => {
      const dot = f.name.lastIndexOf(".");
      return dot > 0 ? f.name.slice(dot) : "";
    }).filter(Boolean)
  )).sort();

  const files = extFilter
    ? allFiles.filter((f) => f.name.endsWith(extFilter))
    : allFiles;

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

          {/* File type filter chips */}
          {allExts.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <button
                onClick={() => setExtFilter(null)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border transition-colors",
                  extFilter === null
                    ? "bg-zinc-700 border-zinc-600 text-zinc-200"
                    : "border-zinc-800 text-zinc-600 hover:text-zinc-400"
                )}
              >
                All
              </button>
              {allExts.map((ext) => (
                <button
                  key={ext}
                  onClick={() => setExtFilter(extFilter === ext ? null : ext)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded border transition-colors font-mono",
                    extFilter === ext
                      ? "bg-violet-900/40 border-violet-700/60 text-violet-300"
                      : "border-zinc-800 text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {ext}
                </button>
              ))}
            </div>
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
                ) : openFile?.endsWith(".md") ? (
                  <div className="px-5 py-4 text-xs text-zinc-300 leading-relaxed prose-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-bold text-zinc-100 mb-2 mt-4 first:mt-0 border-b border-zinc-800 pb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-semibold text-zinc-200 mb-1.5 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xs font-semibold text-zinc-300 mb-1 mt-2 first:mt-0">{children}</h3>,
                        p: ({ children }) => <p className="text-zinc-400 mb-2 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside text-zinc-400 mb-2 space-y-0.5 pl-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside text-zinc-400 mb-2 space-y-0.5 pl-2">{children}</ol>,
                        li: ({ children }) => <li className="text-zinc-400">{children}</li>,
                        code: ({ children, className }) => {
                          const isBlock = className?.includes("language-");
                          return isBlock
                            ? <code className="block bg-zinc-800/60 rounded px-3 py-2 font-mono text-[10px] text-emerald-300 whitespace-pre-wrap overflow-x-auto mb-2">{children}</code>
                            : <code className="bg-zinc-800 rounded px-1 py-0.5 font-mono text-[10px] text-violet-300">{children}</code>;
                        },
                        pre: ({ children }) => <pre className="bg-zinc-800/60 rounded-lg overflow-hidden mb-2">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-700 pl-3 text-zinc-500 italic mb-2">{children}</blockquote>,
                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">{children}</a>,
                        strong: ({ children }) => <strong className="text-zinc-200 font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="text-zinc-400 italic">{children}</em>,
                        hr: () => <hr className="border-zinc-800 my-3" />,
                        table: ({ children }) => <table className="w-full text-[10px] border-collapse mb-2">{children}</table>,
                        th: ({ children }) => <th className="border border-zinc-700 px-2 py-1 text-zinc-300 font-medium bg-zinc-800/40 text-left">{children}</th>,
                        td: ({ children }) => <td className="border border-zinc-700 px-2 py-1 text-zinc-500">{children}</td>,
                      }}
                    >
                      {fileData?.content ?? ""}
                    </ReactMarkdown>
                  </div>
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
