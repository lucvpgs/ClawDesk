/**
 * Centralized agent color palette.
 * Each agent ID maps to a consistent visual identity across the whole app.
 * Fallback: hash-based color for unknown agent IDs.
 */

export interface AgentAccent {
  dot:    string;   // bg-* class for the status dot
  badge:  string;   // bg+text+border classes for the chip/badge
  text:   string;   // text-* class for inline colored text
  avatar: string;   // bg-* for the avatar circle background
  border: string;   // border-l-* for left accent border
}

const FIXED: Record<string, AgentAccent> = {
  "main": {
    dot:    "bg-violet-400",
    badge:  "bg-violet-900/40 text-violet-300 border border-violet-700/50",
    text:   "text-violet-300",
    avatar: "bg-violet-600",
    border: "border-l-violet-500",
  },
  "scout": {
    dot:    "bg-blue-400",
    badge:  "bg-blue-900/40 text-blue-300 border border-blue-700/50",
    text:   "text-blue-300",
    avatar: "bg-blue-600",
    border: "border-l-blue-500",
  },
  "builder-lite": {
    dot:    "bg-emerald-400",
    badge:  "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50",
    text:   "text-emerald-300",
    avatar: "bg-emerald-600",
    border: "border-l-emerald-500",
  },
  "meridian": {
    dot:    "bg-amber-400",
    badge:  "bg-amber-900/40 text-amber-300 border border-amber-700/50",
    text:   "text-amber-300",
    avatar: "bg-amber-600",
    border: "border-l-amber-500",
  },
  "test": {
    dot:    "bg-pink-400",
    badge:  "bg-pink-900/40 text-pink-300 border border-pink-700/50",
    text:   "text-pink-300",
    avatar: "bg-pink-600",
    border: "border-l-pink-500",
  },
};

const FALLBACK_PALETTE: AgentAccent[] = [
  { dot: "bg-indigo-400",  badge: "bg-indigo-900/40 text-indigo-300 border border-indigo-700/50",  text: "text-indigo-300",  avatar: "bg-indigo-600",  border: "border-l-indigo-500"  },
  { dot: "bg-teal-400",    badge: "bg-teal-900/40 text-teal-300 border border-teal-700/50",        text: "text-teal-300",    avatar: "bg-teal-600",    border: "border-l-teal-500"    },
  { dot: "bg-orange-400",  badge: "bg-orange-900/40 text-orange-300 border border-orange-700/50",  text: "text-orange-300",  avatar: "bg-orange-600",  border: "border-l-orange-500"  },
  { dot: "bg-rose-400",    badge: "bg-rose-900/40 text-rose-300 border border-rose-700/50",        text: "text-rose-300",    avatar: "bg-rose-600",    border: "border-l-rose-500"    },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function agentAccent(agentId: string | null | undefined): AgentAccent {
  if (!agentId) return {
    dot: "bg-zinc-600", badge: "bg-zinc-800 text-zinc-400 border border-zinc-700",
    text: "text-zinc-500", avatar: "bg-zinc-700", border: "border-l-zinc-700",
  };
  return FIXED[agentId] ?? FALLBACK_PALETTE[hashId(agentId) % FALLBACK_PALETTE.length];
}

/** Returns the display name initial (first letter uppercase) */
export function agentInitial(agentId: string | null | undefined): string {
  if (!agentId) return "?";
  return agentId.charAt(0).toUpperCase();
}

/** Maps known agent IDs to display names */
const AGENT_NAMES: Record<string, string> = {
  "main":         "Icarus",
  "scout":        "Scout",
  "builder-lite": "Builder Lite",
  "meridian":     "Meridian",
  "test":         "Test",
};

export function agentDisplayName(agentId: string | null | undefined): string {
  if (!agentId) return "Unassigned";
  return AGENT_NAMES[agentId] ?? agentId;
}

export const KNOWN_AGENTS = Object.entries(AGENT_NAMES).map(([id, name]) => ({ id, name }));
