/**
 * Deterministic project color palette.
 * Each project ID maps to a consistent accent color across the whole app.
 */

export interface ProjectAccent {
  dot:      string;   // bg-* for status dot
  border:   string;   // border-l-* for left accent
  folder:   string;   // text-* for the Folder icon
  badge:    string;   // full badge classes (bg + text + border)
  progress: string;   // bg-* for progress bar fill
  text:     string;   // text-* for heading/label
  ring:     string;   // ring-* for hover ring
}

const PALETTE: ProjectAccent[] = [
  {
    dot:      "bg-violet-400",
    border:   "border-l-violet-500",
    folder:   "text-violet-400",
    badge:    "bg-violet-900/30 text-violet-300 border border-violet-700/40",
    progress: "bg-violet-500",
    text:     "text-violet-300",
    ring:     "ring-violet-700/40",
  },
  {
    dot:      "bg-blue-400",
    border:   "border-l-blue-500",
    folder:   "text-blue-400",
    badge:    "bg-blue-900/30 text-blue-300 border border-blue-700/40",
    progress: "bg-blue-500",
    text:     "text-blue-300",
    ring:     "ring-blue-700/40",
  },
  {
    dot:      "bg-emerald-400",
    border:   "border-l-emerald-500",
    folder:   "text-emerald-400",
    badge:    "bg-emerald-900/30 text-emerald-300 border border-emerald-700/40",
    progress: "bg-emerald-500",
    text:     "text-emerald-300",
    ring:     "ring-emerald-700/40",
  },
  {
    dot:      "bg-amber-400",
    border:   "border-l-amber-500",
    folder:   "text-amber-400",
    badge:    "bg-amber-900/30 text-amber-300 border border-amber-700/40",
    progress: "bg-amber-500",
    text:     "text-amber-300",
    ring:     "ring-amber-700/40",
  },
  {
    dot:      "bg-pink-400",
    border:   "border-l-pink-500",
    folder:   "text-pink-400",
    badge:    "bg-pink-900/30 text-pink-300 border border-pink-700/40",
    progress: "bg-pink-500",
    text:     "text-pink-300",
    ring:     "ring-pink-700/40",
  },
  {
    dot:      "bg-indigo-400",
    border:   "border-l-indigo-500",
    folder:   "text-indigo-400",
    badge:    "bg-indigo-900/30 text-indigo-300 border border-indigo-700/40",
    progress: "bg-indigo-500",
    text:     "text-indigo-300",
    ring:     "ring-indigo-700/40",
  },
  {
    dot:      "bg-teal-400",
    border:   "border-l-teal-500",
    folder:   "text-teal-400",
    badge:    "bg-teal-900/30 text-teal-300 border border-teal-700/40",
    progress: "bg-teal-500",
    text:     "text-teal-300",
    ring:     "ring-teal-700/40",
  },
  {
    dot:      "bg-orange-400",
    border:   "border-l-orange-500",
    folder:   "text-orange-400",
    badge:    "bg-orange-900/30 text-orange-300 border border-orange-700/40",
    progress: "bg-orange-500",
    text:     "text-orange-300",
    ring:     "ring-orange-700/40",
  },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function projectAccent(projectId: string | null | undefined): ProjectAccent {
  if (!projectId) return {
    dot: "bg-zinc-600", border: "border-l-zinc-700", folder: "text-zinc-500",
    badge: "bg-zinc-800 text-zinc-400 border border-zinc-700",
    progress: "bg-zinc-600", text: "text-zinc-500", ring: "ring-zinc-700/40",
  };
  return PALETTE[hashId(projectId) % PALETTE.length];
}
