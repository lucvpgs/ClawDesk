"use client";

import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useLicenseContext } from "@/contexts/LicenseContext";

interface Props {
  children: ReactNode;
  /** Short label shown on the lock overlay */
  feature?: string;
  /** If true, render children blurred with a lock overlay */
  blur?: boolean;
}

/**
 * Wraps any Pro feature.
 * - If license is valid → renders children normally
 * - Otherwise → renders a blurred/locked overlay with an upgrade CTA
 */
export function ProGate({ children, feature = "Pro feature", blur = false }: Props) {
  const { isPro, openModal } = useLicenseContext();

  if (isPro) return <>{children}</>;

  if (blur) {
    return (
      <div className="relative select-none">
        <div className="pointer-events-none opacity-30 blur-sm">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/90 border border-violet-700/60 text-violet-300 text-xs font-medium rounded-xl shadow-lg hover:bg-zinc-800 hover:border-violet-500 transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
            {feature} · Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  // Full replacement (used for entire pages/sections)
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] text-center gap-5 px-6">
      <div className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-600/20 flex items-center justify-center">
        <Lock className="w-6 h-6 text-violet-400" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-zinc-100">{feature}</h3>
        <p className="text-xs text-zinc-500 max-w-xs">
          This feature is available with ClawDesk Pro.
          One-time purchase, no subscription.
        </p>
      </div>
      <button
        onClick={openModal}
        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition-colors shadow-lg shadow-violet-900/30"
      >
        Activate Pro — $39
      </button>
      <p className="text-[10px] text-zinc-600">
        Already have a key?{" "}
        <button
          onClick={openModal}
          className="text-violet-500 hover:text-violet-400 transition-colors underline"
        >
          Enter it here
        </button>
      </p>
    </div>
  );
}
