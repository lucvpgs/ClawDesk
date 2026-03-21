"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Server, RefreshCw, CheckCircle, AlertTriangle, XCircle, Plus,
  Radio, CheckCircle2, AlertCircle, Circle,
  Shield, Terminal, Clock, Bot,
  MessageSquare, Search, Hash, Send, GitBranch, FileText, Layers, Webhook,
  ExternalLink, Eye, EyeOff, X, Save, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn, timeAgo, statusDot, statusColor } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RuntimeSourceRow {
  id: string;
  name: string;
  gatewayUrl: string;
  connectionMode: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  state: {
    status: string;
    runtimeVersion: string | null;
    primaryAgentName: string | null;
    lastSeenAt: string | null;
    lastSyncAt: string | null;
    degradedReason: string | null;
    grantedScopes: string | null;
  } | null;
}

interface Channel {
  id: string;
  channelType: string;
  status: string | null;
  observedAt: string | null;
  configured: boolean | null;
  running: boolean | null;
  lastError: string | null;
  probe: { ok: boolean | null; elapsedMs?: number | null } | null;
}

interface AllowlistEntry {
  id: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

interface AgentApprovals {
  agentId: string;
  allowlist: AllowlistEntry[];
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "runtime",      label: "Runtime Sources" },
  { key: "channels",     label: "Channels"        },
  { key: "approvals",    label: "Approvals"        },
  { key: "integrations", label: "Integrations"    },
];

// ── Page wrapper ──────────────────────────────────────────────────────────────
function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") ?? "runtime";

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-base font-semibold text-zinc-100">Settings</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Runtime connections, channels &amp; exec approvals</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.replace(`/settings?tab=${tab.key}`)}
            className={cn(
              "px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "text-zinc-100 border-violet-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "runtime"      && <RuntimeTab />}
        {activeTab === "channels"     && <ChannelsTab />}
        {activeTab === "approvals"    && <ApprovalsTab />}
        {activeTab === "integrations" && <IntegrationsTab />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Runtime Sources
// ══════════════════════════════════════════════════════════════════════════════
function RuntimeTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, refetch } = useQuery<RuntimeSourceRow[]>({
    queryKey: ["runtime-sources"],
    queryFn: () => fetch("/api/runtime-sources").then((r) => r.json()),
  });

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/runtime-sources/sync", { method: "POST" });
      await qc.invalidateQueries();
      refetch();
    } finally {
      setSyncing(false);
    }
  }

  const sources = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {sources.length} connected runtime{sources.length !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-zinc-700 rounded-lg text-zinc-300 hover:border-zinc-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={() => router.push("/onboarding")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add runtime
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Server className="w-8 h-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">No runtimes connected yet.</p>
          <button onClick={() => router.push("/onboarding")} className="text-xs text-violet-400 hover:underline">
            Connect your first OpenClaw runtime →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => <RuntimeSourceCard key={s.id} source={s} />)}
        </div>
      )}
    </div>
  );
}

function RuntimeSourceCard({ source }: { source: RuntimeSourceRow }) {
  const s = source.state;
  const status = s?.status ?? "disconnected";
  const Icon =
    status === "connected" ? CheckCircle :
    status === "degraded"  ? AlertTriangle : XCircle;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot(status))} />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Server className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="text-sm font-medium text-zinc-100">{source.name}</span>
          {source.isDefault && (
            <span className="text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded">
              default
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Icon className={cn("w-3.5 h-3.5", statusColor(status))} />
          <span className={cn("text-xs font-medium", statusColor(status))}>{status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800/60">
        <DetailCell label="Gateway"       value={source.gatewayUrl}         mono />
        <DetailCell label="Mode"          value={source.connectionMode}          />
        <DetailCell label="Version"       value={s?.runtimeVersion ?? "—"} mono />
        <DetailCell label="Primary agent" value={s?.primaryAgentName ?? "—"}     />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-zinc-800/60 border-t border-zinc-800/60">
        <DetailCell label="Last seen" value={timeAgo(s?.lastSeenAt)} />
        <DetailCell label="Last sync" value={timeAgo(s?.lastSyncAt)} />
        <DetailCell
          label="Scopes"
          value={s?.grantedScopes ? JSON.parse(s.grantedScopes).join(", ") : "—"}
        />
      </div>

      {s?.degradedReason && (
        <div className="px-4 py-2 bg-amber-950/30 border-t border-amber-900/30">
          <span className="text-xs text-amber-400">{s.degradedReason}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Channels
// ══════════════════════════════════════════════════════════════════════════════
const CHANNEL_COLOR: Record<string, string> = {
  discord:  "text-indigo-400",
  slack:    "text-yellow-400",
  telegram: "text-blue-400",
  whatsapp: "text-emerald-400",
  sms:      "text-orange-400",
  email:    "text-zinc-300",
};

const CHANNEL_BG: Record<string, string> = {
  discord:  "bg-indigo-900/20 border-indigo-800/30",
  slack:    "bg-yellow-900/20 border-yellow-800/30",
  telegram: "bg-blue-900/20 border-blue-800/30",
  whatsapp: "bg-emerald-900/20 border-emerald-800/30",
  sms:      "bg-orange-900/20 border-orange-800/30",
  email:    "bg-zinc-900/50 border-zinc-800/50",
};

function ChannelsTab() {
  const { data, isLoading, refetch, isFetching } = useQuery<{ channels: Channel[] }>({
    queryKey: ["channels"],
    queryFn: () => fetch("/api/channels").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const channels   = data?.channels ?? [];
  const running    = channels.filter((c) => c.running === true).length;
  const configured = channels.filter((c) => c.configured === true).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{running} running · {configured} configured</p>
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

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : channels.length === 0 ? (
        <div className="text-sm text-zinc-600 py-12 text-center">No channels synced from runtime.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {channels.map((ch) => <ChannelCard key={ch.id} channel={ch} />)}
        </div>
      )}
    </div>
  );
}

function ChannelCard({ channel }: { channel: Channel }) {
  const type      = channel.channelType.toLowerCase();
  const isRunning = channel.running === true;
  const isCfg     = channel.configured === true;
  const probeOk   = channel.probe?.ok === true;

  return (
    <div className={cn("border rounded-lg overflow-hidden", CHANNEL_BG[type] ?? "bg-zinc-900/50 border-zinc-800/50")}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        {isRunning && probeOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
         isRunning            ? <AlertCircle  className="w-4 h-4 text-amber-400 shrink-0"   /> :
         isCfg                ? <Circle       className="w-4 h-4 text-zinc-500 shrink-0"    /> :
                                <XCircle      className="w-4 h-4 text-zinc-700 shrink-0"    />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Radio className={cn("w-3.5 h-3.5", CHANNEL_COLOR[type] ?? "text-zinc-400")} />
            <span className={cn("text-sm font-medium capitalize", CHANNEL_COLOR[type] ?? "text-zinc-100")}>
              {channel.channelType}
            </span>
          </div>
          {channel.observedAt && (
            <span className="text-[10px] text-zinc-600">observed {timeAgo(channel.observedAt)}</span>
          )}
        </div>
        {isRunning ? (
          <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded">running</span>
        ) : isCfg ? (
          <span className="text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700/50 px-1.5 py-0.5 rounded">configured</span>
        ) : (
          <span className="text-[10px] bg-zinc-900 text-zinc-700 border border-zinc-800 px-1.5 py-0.5 rounded">inactive</span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        <ChannelRow label="Configured" value={isCfg      ? "Yes" : "No"} ok={isCfg}      />
        <ChannelRow label="Running"    value={isRunning   ? "Yes" : "No"} ok={isRunning}   />
        {channel.probe && (
          <ChannelRow label="Probe" value={probeOk ? `OK (${channel.probe.elapsedMs ?? "?"}ms)` : "Failed"} ok={probeOk} />
        )}
        {channel.lastError && (
          <div className="mt-2 bg-red-900/20 border border-red-800/30 rounded px-2.5 py-1.5">
            <div className="text-[10px] text-red-500 uppercase tracking-wider mb-0.5">Last error</div>
            <div className="text-xs text-red-400 break-all">{channel.lastError}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</span>
      <span className={cn("text-xs font-mono", ok === true ? "text-emerald-400" : ok === false ? "text-red-400" : "text-zinc-400")}>
        {value}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Approvals
// ══════════════════════════════════════════════════════════════════════════════
function ApprovalsTab() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    agents: AgentApprovals[];
    version: number;
    error?: string;
  }>({
    queryKey: ["approvals"],
    queryFn: () => fetch("/api/approvals").then((r) => r.json()),
  });

  const agents       = data?.agents ?? [];
  const totalEntries = agents.reduce((sum, a) => sum + a.allowlist.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {totalEntries} approved exec patterns across {agents.length} agent{agents.length !== 1 ? "s" : ""}
        </p>
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

      {data?.error && (
        <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg px-4 py-3 text-xs text-amber-400">
          {data.error}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : agents.length === 0 ? (
        <div className="text-sm text-zinc-600 py-12 text-center">No exec approvals found.</div>
      ) : (
        <div className="space-y-5">
          {agents.map((agent) => (
            <div key={agent.agentId}>
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-sm font-medium text-zinc-200 capitalize">{agent.agentId}</span>
                <span className="text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700/50 px-1.5 py-0.5 rounded">
                  {agent.allowlist.length} patterns
                </span>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-600">
                  <div className="col-span-4">Pattern</div>
                  <div className="col-span-5">Last command</div>
                  <div className="col-span-3 text-right">Last used</div>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {agent.allowlist.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-zinc-700 text-center">No approved patterns</div>
                  ) : (
                    agent.allowlist.map((entry) => (
                      <div key={entry.id} className="grid grid-cols-12 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                          <Terminal className="w-3 h-3 text-zinc-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-mono text-zinc-300 truncate">{entry.pattern}</div>
                            {entry.lastResolvedPath && entry.lastResolvedPath !== entry.pattern && (
                              <div className="text-[10px] font-mono text-zinc-600 truncate">→ {entry.lastResolvedPath}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-5 flex items-center min-w-0 px-2">
                          {entry.lastUsedCommand ? (
                            <span className="text-[10px] font-mono text-zinc-500 truncate">
                              {entry.lastUsedCommand.split("\n")[0]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-700">—</span>
                          )}
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          {entry.lastUsedAt ? (
                            <>
                              <Clock className="w-3 h-3 text-zinc-700" />
                              <span className="text-[10px] text-zinc-600">{msAgo(entry.lastUsedAt)}</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-zinc-700">never</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-4 py-3">
        <div className="flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-600">
            Exec approvals control which commands agents are permitted to run. Patterns are glob-matched
            against the resolved binary path. Stored in{" "}
            <code className="font-mono text-zinc-500">~/.openclaw/exec-approvals.json</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Integrations
// ══════════════════════════════════════════════════════════════════════════════

interface IntegrationField {
  key: string; label: string;
  type: "token" | "api_key" | "webhook_url" | "text" | "boolean" | "select";
  sensitive?: boolean; required?: boolean;
  placeholder?: string; hint?: string; options?: string[];
}

interface Integration {
  id: string; name: string; description: string | null;
  category: string; icon: string; docsUrl: string | null;
  source: "catalog" | "custom";
  connected: boolean; enabled: boolean;
  authType: string | null;
  fields: IntegrationField[];
  credentials: Record<string, string | boolean>;
  notes?: string | null;
}

interface CatalogEntry { id: string; name: string; description: string; category: string; icon: string; }

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Search, Hash, Send, GitBranch, FileText, Layers, Webhook,
};

const CATEGORY_LABELS: Record<string, string> = {
  messaging: "Messaging", search: "Search", developer: "Developer",
  productivity: "Productivity", custom: "Custom",
};

const AUTH_TYPES = [
  { value: "api_key", label: "API Key" },
  { value: "token",   label: "Bearer Token" },
  { value: "webhook", label: "Webhook URL" },
  { value: "basic",   label: "Username / Password" },
  { value: "oauth",   label: "OAuth (Client ID + Secret)" },
  { value: "multi",   label: "Multiple fields (custom)" },
];

// ── Main tab ──────────────────────────────────────────────────────────────────
function IntegrationsTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd]       = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ integrations: Integration[]; catalog: CatalogEntry[] }>({
    queryKey: ["integrations"],
    queryFn:  () => fetch("/api/integrations").then((r) => r.json()),
  });

  const integrations = data?.integrations ?? [];
  const catalog      = data?.catalog ?? [];
  const categories   = [...new Set(integrations.map((i) => i.category))];
  const editingItem  = editingId ? integrations.find((i) => i.id === editingId) ?? null : null;

  function onSaved() {
    qc.invalidateQueries({ queryKey: ["integrations"] });
    setEditingId(null);
    setShowAdd(false);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {integrations.length === 0
            ? "No integrations configured"
            : `${integrations.filter((i) => i.enabled).length} active · ${integrations.length} total`}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add integration
          </button>
        </div>
      </div>

      {/* Empty state */}
      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : integrations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 border border-dashed border-zinc-800 rounded-lg">
          <Webhook className="w-8 h-8 text-zinc-700" />
          <p className="text-sm text-zinc-600">No integrations connected yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add first integration
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              <div className="space-y-2">
                {integrations
                  .filter((i) => i.category === cat)
                  .map((integration) => (
                    <IntegrationRow
                      key={integration.id}
                      integration={integration}
                      onEdit={() => setEditingId(integration.id)}
                      onSaved={onSaved}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-4 py-3">
        <div className="flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-600">
            Catalog integrations (Discord, Brave, GitHub…) write directly to{" "}
            <code className="font-mono text-zinc-500">~/.openclaw/openclaw.json</code> so OpenClaw picks them up natively.
            Custom integrations are stored in{" "}
            <code className="font-mono text-zinc-500">~/.openclaw/integrations.json</code> and can be accessed by agents via skills.
            Restart OpenClaw after saving catalog integrations.
          </p>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <AddIntegrationModal
          catalog={catalog}
          connectedIds={integrations.map((i) => i.id)}
          onClose={() => setShowAdd(false)}
          onSaved={onSaved}
        />
      )}

      {/* Edit modal */}
      {editingItem && (
        <EditIntegrationModal
          integration={editingItem}
          onClose={() => setEditingId(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ── Integration row (compact card) ────────────────────────────────────────────
function IntegrationRow({
  integration, onEdit, onSaved,
}: {
  integration: Integration;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const IconComp = ICON_MAP[integration.icon] ?? Webhook;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);

  // First masked credential to show as a hint
  const credHint = Object.entries(integration.credentials)
    .find(([, v]) => typeof v === "string" && (v as string).startsWith("••••"));

  async function handleRemove() {
    setRemoving(true);
    await fetch(`/api/integrations/${integration.id}`, { method: "DELETE" });
    setRemoving(false);
    onSaved();
  }

  return (
    <div className={cn(
      "flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 border-l-4",
      integration.enabled ? "border-l-emerald-500" : "border-l-zinc-700"
    )}>
      <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
        <IconComp className="w-3.5 h-3.5 text-zinc-300" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100">{integration.name}</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border",
            integration.enabled
              ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/40"
              : "bg-zinc-800 text-zinc-500 border-zinc-700"
          )}>
            {integration.enabled ? "active" : "disabled"}
          </span>
          {integration.source === "custom" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-400 border border-violet-800/40">
              custom
            </span>
          )}
        </div>
        {credHint && (
          <span className="text-[10px] font-mono text-zinc-600">{credHint[0]}: {credHint[1]}</span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {integration.docsUrl && (
          <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
            className="p-1.5 text-zinc-700 hover:text-zinc-400 transition-colors" title="Docs">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button onClick={onEdit}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 border border-zinc-800 rounded transition-colors text-[10px] px-2 flex items-center gap-1">
          Edit
        </button>
        {confirmDelete ? (
          <>
            <button onClick={handleRemove} disabled={removing}
              className="p-1.5 text-red-400 hover:text-red-300 text-[10px] px-2 border border-red-800/50 rounded transition-colors">
              {removing ? "…" : "Confirm"}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="p-1.5 text-zinc-600 hover:text-zinc-400 text-[10px]">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add Integration Modal ─────────────────────────────────────────────────────
type AddStep = "pick" | "form";

function AddIntegrationModal({
  catalog, connectedIds, onClose, onSaved,
}: {
  catalog: CatalogEntry[];
  connectedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep]           = useState<AddStep>("pick");
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogEntry | null>(null);
  const [isCustom, setIsCustom]   = useState(false);

  // Custom form state
  const [customName,     setCustomName]     = useState("");
  const [customCategory, setCustomCategory] = useState("custom");
  const [customAuthType, setCustomAuthType] = useState("api_key");
  const [customNotes,    setCustomNotes]    = useState("");
  const [credentials,    setCredentials]    = useState<Record<string, string | boolean>>({});
  const [showSecrets,    setShowSecrets]    = useState<Record<string, boolean>>({});
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // AUTH_TYPES_FIELDS resolved at render time based on selection
  const AUTH_TYPE_FIELDS_UI: Record<string, IntegrationField[]> = {
    api_key: [{ key: "apiKey",  label: "API Key",       type: "api_key",     sensitive: true, required: true }],
    token:   [{ key: "token",   label: "Bearer Token",  type: "token",       sensitive: true, required: true }],
    webhook: [{ key: "url",     label: "Webhook URL",   type: "webhook_url", required: true },
              { key: "secret",  label: "Secret",        type: "token",       sensitive: true }],
    basic:   [{ key: "username",label: "Username",      type: "text",        required: true },
              { key: "password",label: "Password",      type: "token",       sensitive: true, required: true }],
    oauth:   [{ key: "clientId",    label: "Client ID",     type: "text",    required: true },
              { key: "clientSecret",label: "Client Secret", type: "api_key", sensitive: true, required: true },
              { key: "accessToken", label: "Access Token",  type: "token",   sensitive: true }],
    multi:   [],
  };

  const activeFields: IntegrationField[] = selectedCatalog
    ? [] // catalog fields come from the EditIntegrationModal flow
    : (AUTH_TYPE_FIELDS_UI[customAuthType] ?? []);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const body = selectedCatalog
        ? { source: "catalog", id: selectedCatalog.id, credentials }
        : { source: "custom", name: customName.trim(), category: customCategory,
            authType: customAuthType, notes: customNotes, credentials };

      const res = await fetch("/api/integrations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const availableCatalog = catalog.filter((c) => !connectedIds.includes(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[520px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            {step === "form" && (
              <button onClick={() => { setStep("pick"); setSelectedCatalog(null); setIsCustom(false); }}
                className="text-[10px] text-violet-400 hover:underline mr-1">← back</button>
            )}
            <Webhook className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              {step === "pick" ? "Add Integration" : selectedCatalog ? `Connect ${selectedCatalog.name}` : "Custom Integration"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</div>
          )}

          {/* STEP 1 — Pick */}
          {step === "pick" && (
            <div className="space-y-4">
              {availableCatalog.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Quick connect</div>
                  <div className="grid grid-cols-3 gap-2">
                    {availableCatalog.map((entry) => {
                      const IconComp = ICON_MAP[entry.icon] ?? Webhook;
                      return (
                        <button
                          key={entry.id}
                          onClick={() => { setSelectedCatalog(entry); setIsCustom(false); setStep("form"); }}
                          className="flex flex-col items-center gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-violet-700 hover:bg-violet-950/20 transition-colors text-center"
                        >
                          <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                            <IconComp className="w-4 h-4 text-zinc-300" />
                          </div>
                          <span className="text-xs text-zinc-300 font-medium">{entry.name}</span>
                          <span className="text-[10px] text-zinc-600 leading-tight">{entry.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={availableCatalog.length > 0 ? "border-t border-zinc-800 pt-4" : ""}>
                <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Custom integration</div>
                <button
                  onClick={() => { setIsCustom(true); setStep("form"); }}
                  className="w-full flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-violet-700 hover:bg-violet-950/20 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-300 font-medium">Custom</div>
                    <div className="text-[10px] text-zinc-600">Any service — define your own name, category and credentials</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Form */}
          {step === "form" && selectedCatalog && (
            <CatalogConnectForm
              entry={selectedCatalog}
              credentials={credentials}
              showSecrets={showSecrets}
              onCredentialChange={(k, v) => setCredentials((c) => ({ ...c, [k]: v }))}
              onToggleSecret={(k) => setShowSecrets((s) => ({ ...s, [k]: !s[k] }))}
            />
          )}

          {step === "form" && isCustom && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Name <span className="text-red-500">*</span></label>
                  <input autoFocus className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                    placeholder="Airtable" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Category</label>
                  <select className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
                    value={customCategory} onChange={(e) => setCustomCategory(e.target.value)}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Auth type</label>
                <select className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
                  value={customAuthType} onChange={(e) => { setCustomAuthType(e.target.value); setCredentials({}); }}>
                  {AUTH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {activeFields.map((f) => (
                <CredentialField key={f.key} field={f} value={credentials[f.key]}
                  showSecret={showSecrets[f.key] ?? false}
                  onToggleSecret={() => setShowSecrets((s) => ({ ...s, [f.key]: !s[f.key] }))}
                  onChange={(v) => setCredentials((c) => ({ ...c, [f.key]: v }))} />
              ))}
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider">Notes <span className="text-zinc-700">(optional)</span></label>
                <input className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-400 outline-none focus:border-zinc-600"
                  placeholder="What this integration is used for…" value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "form" && (
          <div className="px-6 py-4 border-t border-zinc-800 flex gap-2 shrink-0">
            <button onClick={onClose} className="flex-1 py-2 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || (isCustom && !customName.trim())}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Integration Modal ────────────────────────────────────────────────────
function EditIntegrationModal({
  integration, onClose, onSaved,
}: {
  integration: Integration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [credentials,  setCredentials]  = useState<Record<string, string | boolean>>({ ...integration.credentials });
  const [enabled,      setEnabled]      = useState(integration.enabled);
  const [showSecrets,  setShowSecrets]  = useState<Record<string, boolean>>({});
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, enabled }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const IconComp = ICON_MAP[integration.icon] ?? Webhook;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-[460px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="w-7 h-7 bg-zinc-800 rounded-md flex items-center justify-center">
            <IconComp className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-100">{integration.name}</div>
            <div className="text-[10px] text-zinc-600 capitalize">{integration.category} · {integration.source}</div>
          </div>
          {/* Enabled toggle */}
          <button onClick={() => setEnabled(!enabled)}
            className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0", enabled ? "bg-emerald-600" : "bg-zinc-700")}>
            <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-[18px]" : "translate-x-[2px]")} />
          </button>
          <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</div>}
          {integration.fields.map((f) => (
            <CredentialField key={f.key} field={f} value={credentials[f.key]}
              showSecret={showSecrets[f.key] ?? false}
              onToggleSecret={() => setShowSecrets((s) => ({ ...s, [f.key]: !s[f.key] }))}
              onChange={(v) => setCredentials((c) => ({ ...c, [f.key]: v }))} />
          ))}
        </div>

        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 transition-colors">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Catalog connect form (fields for a specific catalog entry) ─────────────────
function CatalogConnectForm({
  entry, credentials, showSecrets, onCredentialChange, onToggleSecret,
}: {
  entry: CatalogEntry;
  credentials: Record<string, string | boolean>;
  showSecrets: Record<string, boolean>;
  onCredentialChange: (k: string, v: string | boolean) => void;
  onToggleSecret: (k: string) => void;
}) {
  // Fetch full field definition for this catalog entry from the API
  const { data } = useQuery<{ integrations: Integration[]; catalog: CatalogEntry[] }>({
    queryKey: ["integrations"],
    enabled: false, // uses cached data
  });

  // We need field definitions — use the static list from the API catalog
  // Since we have the full response cached, we can find the entry's fields
  // Fallback: generic "token" field if not found
  const knownFields: IntegrationField[] = [
    { key: "enabled", label: "Enabled", type: "boolean" },
    { key: "token",   label: "Primary credential", type: "token", sensitive: true, required: true,
      hint: `From ${entry.name} developer console` },
  ];

  // Try to get actual fields from cached query data
  const fields = (data?.integrations.find((i) => i.id === entry.id)?.fields) ?? knownFields;
  const IconComp = ICON_MAP[entry.icon] ?? Webhook;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5">
        <div className="w-7 h-7 bg-zinc-800 rounded-md flex items-center justify-center">
          <IconComp className="w-3.5 h-3.5 text-zinc-300" />
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-200">{entry.name}</div>
          <div className="text-[10px] text-zinc-600">{entry.description}</div>
        </div>
      </div>
      {fields.map((f) => (
        <CredentialField key={f.key} field={f} value={credentials[f.key]}
          showSecret={showSecrets[f.key] ?? false}
          onToggleSecret={() => onToggleSecret(f.key)}
          onChange={(v) => onCredentialChange(f.key, v)} />
      ))}
    </div>
  );
}

// ── Shared credential field component ─────────────────────────────────────────
function CredentialField({
  field, value, showSecret, onToggleSecret, onChange,
}: {
  field: IntegrationField;
  value: string | boolean | undefined;
  showSecret: boolean;
  onToggleSecret: () => void;
  onChange: (val: string | boolean) => void;
}) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs text-zinc-300">{field.label}</label>
          {field.hint && <p className="text-[10px] text-zinc-600 mt-0.5">{field.hint}</p>}
        </div>
        <button onClick={() => onChange(!(value as boolean))}
          className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", value ? "bg-emerald-600" : "bg-zinc-700")}>
          <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", value ? "translate-x-[18px]" : "translate-x-[2px]")} />
        </button>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="text-[10px] text-zinc-600 uppercase tracking-wider">{field.label}</label>
        <select className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
          value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        {field.hint && <p className="text-[10px] text-zinc-600 mt-1">{field.hint}</p>}
      </div>
    );
  }

  const isPopulated = typeof value === "string" && value.length > 0;
  const inputType   = field.sensitive && !showSecret ? "password" : "text";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-zinc-600 uppercase tracking-wider">
          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {field.sensitive && isPopulated && (
          <button onClick={onToggleSecret} className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1">
            {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showSecret ? "hide" : "show"}
          </button>
        )}
      </div>
      <input type={inputType}
        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-violet-500"
        placeholder={field.placeholder} value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)} />
      {field.hint && <p className="text-[10px] text-zinc-600 mt-1">{field.hint}</p>}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function DetailCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[10px] text-zinc-600 mb-0.5 uppercase tracking-wider">{label}</div>
      <div className={cn("text-xs text-zinc-300 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function msAgo(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
