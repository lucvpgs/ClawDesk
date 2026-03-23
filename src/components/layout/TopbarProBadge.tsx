"use client";

import { KeyRound, Sparkles } from "lucide-react";
import { useLicenseContext } from "@/contexts/LicenseContext";

export function TopbarProBadge() {
  const { isPro, openModal } = useLicenseContext();
  return isPro ? (
    <button
      onClick={openModal}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-600/15 border border-violet-700/40 text-violet-300 text-[10px] font-medium hover:bg-violet-600/25 transition-colors"
      title="ClawDesk Pro — click to manage license"
    >
      <Sparkles className="w-3 h-3" />
      Pro
    </button>
  ) : (
    <button
      onClick={openModal}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-700 text-zinc-500 text-[10px] font-medium hover:border-violet-700 hover:text-violet-400 transition-colors"
      title="Upgrade to ClawDesk Pro"
    >
      <KeyRound className="w-3 h-3" />
      Upgrade
    </button>
  );
}
