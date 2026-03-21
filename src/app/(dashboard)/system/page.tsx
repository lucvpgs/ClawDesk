"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Radio,
  Terminal,
  Cpu,
  Clock,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

interface ChannelHealth {
  channelType: string;
  status: string | null;
  running: boolean | null;
  configured: boolean | null;
  lastError: string | null;
  probe: { ok: boolean | null; elapsedMs?: number | null } | null;
  observedAt: string | null;
}

interface SystemData {
  noRuntime?: boolean;
  source: {
    id: string;
    name: string;
    gatewayUrl: string;
    cliBinary: string | null;
    status: string;
    lastSeenAt: string | null;
    lastSyncAt: string | null;
    degradedReason: string | null;
  };
  runtime: {
    version: string | null;
    uptime: string | number | null;
    sessionDefaultModel: string | null;
    sessionDefaultContextTokens: number | null;
  };
  channels: ChannelHealth[];
  scan: {
    version: string | null;
    cliBinary: string | null;
    agentCount: number | null;
  } | null;
}

const STATUS_STYLES: Record<string, { dot: string; text: string; icon: React.ReactNode }> = {
  connected: { dot: "bg-emerald-400", text: "text-emerald-400", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
  degraded: { dot: "bg-amber-400", text: "text-amber-400", icon: <AlertCircle className="w-4 h-4 text-amber-400" /> },
  disconnected: { dot: "bg-zinc-600", text: "text-zinc-500", icon: <XCircle className="w-4 h-4 text-zinc-600" /> },
  error: { dot: "bg-red-400", text: "text-red-400", icon: <XCircle className="w-4 h-4 text-red-400" /> },
};

export default function SystemPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<SystemData>({
    queryKey: ["system"],
    queryFn: () => fetch("/api/system").then((r) => r.json()),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      </div>
    );
  }

  if (data?.noRuntime) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-base font-semibold text-zinc-100 mb-1">System</h1>
        <p className="text-xs text-zinc-500">No runtime configured.</p>
      </div>
    );
  }

  const status = data?.source.status ?? "unknown";
  const styles = STATUS_STYLES[status] ?? { dot: "bg-zinc-600", text: "text-zinc-400", icon: null };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-100">System</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Runtime diagnostics and health</p>
        </div>
        <button
          onClick={() => refetch()}
          className={cn(
            "p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors",
            isFetching && "animate-spin text-violet-400"
          )}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Runtime source card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
          {styles.icon}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-100">{data?.source.name}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", {
                "bg-emerald-900/30 text-emerald-400 border-emerald-800/50": status === "connected",
                "bg-amber-900/30 text-amber-400 border-amber-800/50": status === "degraded",
                "bg-zinc-800 text-zinc-500 border-zinc-700/50": status === "disconnected",
                "bg-red-900/30 text-red-400 border-red-800/50": status === "error",
              })}>
                {status}
              </span>
            </div>
            {data?.source.degradedReason && (
              <p className="text-xs text-amber-500 mt-0.5">{data.source.degradedReason}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800/60">
          <InfoCell icon={<Terminal className="w-3 h-3" />} label="Gateway URL" value={data?.source.gatewayUrl ?? "—"} mono />
          <InfoCell icon={<Cpu className="w-3 h-3" />} label="Runtime version" value={data?.runtime.version ?? "—"} mono />
          <InfoCell icon={<Clock className="w-3 h-3" />} label="Last seen" value={data?.source.lastSeenAt ? timeAgo(data.source.lastSeenAt) : "—"} />
          <InfoCell icon={<RefreshCw className="w-3 h-3" />} label="Last synced" value={data?.source.lastSyncAt ? timeAgo(data.source.lastSyncAt) : "—"} />
        </div>
      </div>

      {/* Session defaults */}
      {(data?.runtime.sessionDefaultModel || data?.runtime.sessionDefaultContextTokens) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Session defaults</div>
          <div className="flex flex-wrap gap-6">
            {data?.runtime.sessionDefaultModel && (
              <div>
                <div className="text-[10px] text-zinc-600">Model</div>
                <div className="text-sm font-mono text-violet-300">{data.runtime.sessionDefaultModel}</div>
              </div>
            )}
            {data?.runtime.sessionDefaultContextTokens && (
              <div>
                <div className="text-[10px] text-zinc-600">Context tokens</div>
                <div className="text-sm font-mono text-zinc-300">
                  {Number(data.runtime.sessionDefaultContextTokens).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLI info */}
      {data?.scan && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Local CLI</div>
          <div className="flex flex-wrap gap-6">
            {data.scan.cliBinary && (
              <div>
                <div className="text-[10px] text-zinc-600">Binary</div>
                <div className="text-xs font-mono text-zinc-300">{data.scan.cliBinary}</div>
              </div>
            )}
            {data.scan.version && (
              <div>
                <div className="text-[10px] text-zinc-600">Version</div>
                <div className="text-xs font-mono text-zinc-300">{data.scan.version}</div>
              </div>
            )}
            {data.scan.agentCount !== null && (
              <div>
                <div className="text-[10px] text-zinc-600">Agents in config</div>
                <div className="text-xs font-mono text-zinc-300">{data.scan.agentCount}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Channels health */}
      {data?.channels && data.channels.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Channel health</div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="grid grid-cols-5 px-4 py-2 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-600">
              <div>Channel</div>
              <div>Status</div>
              <div>Running</div>
              <div>Probe</div>
              <div>Last error</div>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {data.channels.map((ch) => (
                <ChannelRow key={ch.channelType} channel={ch} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelRow({ channel }: { channel: ChannelHealth }) {
  const isRunning = channel.running === true;
  const probeOk = channel.probe?.ok === true;

  return (
    <div className="grid grid-cols-5 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
      <div className="flex items-center gap-1.5">
        <Radio className="w-3 h-3 text-zinc-600" />
        <span className="text-xs text-zinc-300 capitalize">{channel.channelType}</span>
      </div>
      <div>
        <span className={cn("text-xs", {
          "text-emerald-400": channel.status === "active",
          "text-zinc-500": channel.status === "configured",
          "text-red-400": channel.status === "error",
          "text-zinc-600": !channel.status,
        })}>
          {channel.status ?? "—"}
        </span>
      </div>
      <div>
        {isRunning ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-zinc-700" />
        )}
      </div>
      <div>
        {channel.probe ? (
          <span className={cn("text-xs font-mono", probeOk ? "text-emerald-400" : "text-red-400")}>
            {probeOk ? `OK ${channel.probe.elapsedMs ? `(${channel.probe.elapsedMs}ms)` : ""}` : "Fail"}
          </span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </div>
      <div className="truncate">
        {channel.lastError ? (
          <span className="text-xs text-red-400 truncate">{channel.lastError}</span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </div>
    </div>
  );
}

function InfoCell({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1 text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wider">
        {icon}{label}
      </div>
      <div className={cn("text-xs text-zinc-300 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}
