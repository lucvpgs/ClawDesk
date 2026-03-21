"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  CheckSquare,
  FolderKanban,
  FileText,
  Brain,
  CalendarClock,
  Cpu,
  Activity,
  Settings,
  Zap,
  AlertTriangle,
  LogOut,
} from "lucide-react";

interface VersionInfo {
  openclawVersion:  string;
  clawdeskVersion:  string;
  lastCheckedAt:    string | null;
  latestAvailable:  string | null;
  updateAvailable:  boolean;
}

const STORAGE_KEY = "clawdesk:lastSeenOpenclawVersion";

const navItems = [
  { label: "Overview",  href: "/overview",  icon: LayoutDashboard },
  { label: "Agents",    href: "/agents",    icon: Bot             },
  { label: "Tasks",     href: "/tasks",     icon: CheckSquare     },
  { label: "Projects",  href: "/projects",  icon: FolderKanban    },
  { label: "Schedules", href: "/schedules", icon: CalendarClock   },
  { label: "Models",    href: "/models",    icon: Cpu             },
  { label: "Memory",    href: "/memory",    icon: Brain           },
  { label: "Docs",      href: "/docs",      icon: FileText        },
  { label: "Activity",  href: "/activity",  icon: Activity        },
  { label: "Settings",  href: "/settings",  icon: Settings        },
];

export function Sidebar() {
  const pathname    = usePathname();
  const router      = useRouter();
  const prevVersion = useRef<string | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const { data: versionInfo } = useQuery<VersionInfo>({
    queryKey: ["openclaw-version"],
    queryFn:  () => fetch("/api/openclaw/version").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Detect version change since last visit
  useEffect(() => {
    if (!versionInfo?.openclawVersion || versionInfo.openclawVersion === "unknown") return;

    const current  = versionInfo.openclawVersion;
    const lastSeen = localStorage.getItem(STORAGE_KEY);

    if (lastSeen && lastSeen !== current && prevVersion.current !== current) {
      prevVersion.current = current;
      toast(
        `OpenClaw updated to ${current} — some ClawDesk features may need a refresh`,
        "warning"
      );
    }

    localStorage.setItem(STORAGE_KEY, current);
  }, [versionInfo?.openclawVersion]);

  const versionChanged = (() => {
    if (typeof window === "undefined") return false;
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    return !!lastSeen &&
      !!versionInfo?.openclawVersion &&
      versionInfo.openclawVersion !== "unknown" &&
      lastSeen !== versionInfo.openclawVersion;
  })();

  return (
    <aside className="w-56 min-h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="h-12 flex items-center px-4 border-b border-zinc-800 gap-2">
        <Zap className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          Clawdesk
        </span>
        <span className="ml-auto text-[10px] text-zinc-600 font-mono">MC</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors",
                active
                  ? "text-zinc-100 bg-zinc-800/60"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  active ? "text-violet-400" : "text-zinc-600"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — version info + logout */}
      <div className="border-t border-zinc-800 px-4 py-2.5 flex flex-col gap-1">
        {/* OpenClaw version */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-600 font-mono leading-none">OpenClaw</span>
          <span className="text-[10px] text-zinc-500 font-mono leading-none">
            {versionInfo?.openclawVersion ?? "…"}
          </span>
          {versionChanged && (
            <span title="OpenClaw version changed — some features may need review" className="ml-auto">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
            </span>
          )}
        </div>
        {/* ClawDesk version + logout */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-700 font-mono leading-none">ClawDesk</span>
          <span className="text-[10px] text-zinc-700 font-mono leading-none">
            {versionInfo?.clawdeskVersion ?? "1.0.0"}
          </span>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="ml-auto p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}
