"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileJson, FileText } from "lucide-react";
import { downloadJSON, downloadCSV, exportFilename } from "@/lib/export";

interface ExportMenuProps {
  /** Entity name used in the filename: "tasks", "activity", etc. */
  entity: string;
  /** Data rows to export */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  /** Column order for CSV (optional — defaults to all keys) */
  columns?: string[];
}

export function ExportMenu({ entity, data, columns }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleCSV() {
    downloadCSV(data, exportFilename(entity, "csv"), columns);
    setOpen(false);
  }

  function handleJSON() {
    downloadJSON(data, exportFilename(entity, "json"));
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors"
        title="Export"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={handleCSV}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            CSV
          </button>
          <button
            onClick={handleJSON}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <FileJson className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
