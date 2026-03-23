"use client";

import { useLicenseContext } from "@/contexts/LicenseContext";

/** Small inline PRO badge shown next to gated nav items when user is not Pro. */
export function SidebarNavProBadge() {
  const { isPro } = useLicenseContext();
  if (isPro) return null;
  return (
    <span className="ml-auto text-[9px] font-semibold tracking-wide px-1 py-px rounded bg-violet-900/40 text-violet-400 border border-violet-800/50 leading-tight">
      PRO
    </span>
  );
}
