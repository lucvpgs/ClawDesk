"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Server, RefreshCw, CheckCircle, AlertTriangle, XCircle, Plus,
  Radio, CheckCircle2, AlertCircle, Circle,
  Shield, Terminal, Clock, Bot,
  MessageSquare, Search, Hash, Send, GitBranch, FileText, Layers, Webhook,
  ExternalLink, Eye, EyeOff, X, Save, Trash2, ChevronDown, ChevronUp, Loader2, FlaskConical,
  Archive, Upload,
} from "lucide-react";
import { cn, timeAgo, statusDot, statusColor } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { ProGate } from "@/components/ProGate";

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
  { key: "backup",       label: "Backup & Restore" },
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
        {activeTab === "backup"       && <BackupTab />}
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
  googlechat: "text-green-400",
  sms:      "text-orange-400",
  email:    "text-zinc-300",
};

const CHANNEL_BG: Record<string, string> = {
  discord:    "bg-indigo-900/20 border-indigo-800/30",
  slack:      "bg-yellow-900/20 border-yellow-800/30",
  telegram:   "bg-blue-900/20 border-blue-800/30",
  whatsapp:   "bg-emerald-900/20 border-emerald-800/30",
  googlechat: "bg-green-900/20 border-green-800/30",
  sms:        "bg-orange-900/20 border-orange-800/30",
  email:      "bg-zinc-900/50 border-zinc-800/50",
};

type AddChannelType = "discord" | "telegram" | "slack" | "googlechat";

const ADD_CHANNEL_OPTIONS: { value: AddChannelType; label: string }[] = [
  { value: "discord",    label: "Discord"     },
  { value: "telegram",   label: "Telegram"    },
  { value: "slack",      label: "Slack"       },
  { value: "googlechat", label: "Google Chat" },
];

function ChannelsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery<{ channels: Channel[] }>({
    queryKey: ["channels"],
    queryFn: () => fetch("/api/channels").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const [showAdd, setShowAdd] = useState(false);

  const channels   = data?.channels ?? [];
  const running    = channels.filter((c) => c.running === true).length;
  const configured = channels.filter((c) => c.configured === true).length;

  function handleAdded() {
    setShowAdd(false);
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["channels"] }), 800);
  }

  function handleRemoved() {
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["channels"] }), 800);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{running} running · {configured} configured</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-md transition-colors"
          >
            <Plus className="w-3 h-3" /> Add channel
          </button>
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
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-zinc-600">No channels configured yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-md transition-colors"
          >
            <Plus className="w-3 h-3" /> Add your first channel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <ChannelCard key={ch.id} channel={ch} onRemoved={handleRemoved} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddChannelModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
    </div>
  );
}

function ChannelCard({ channel, onRemoved }: { channel: Channel; onRemoved: () => void }) {
  const type      = channel.channelType.toLowerCase();
  const isRunning = channel.running === true;
  const isCfg     = channel.configured === true;
  const probeOk   = channel.probe?.ok === true;
  const [removing, setRemoving]         = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState<{
    ok: boolean; message: string; elapsedMs?: number;
  } | null>(null);

  async function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setRemoving(true);
    try {
      await fetch("/api/channels/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channel.channelType }),
      });
      onRemoved();
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res  = await fetch("/api/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelType: channel.channelType }),
      });
      const data = await res.json() as {
        probe?: { ok: boolean; elapsedMs?: number };
        running?: boolean;
        error?: string;
      };
      if (data.error) {
        setTestResult({ ok: false, message: data.error });
      } else if (data.probe) {
        setTestResult({
          ok: data.probe.ok,
          message: data.probe.ok ? "Connection OK" : "Probe failed",
          elapsedMs: data.probe.elapsedMs,
        });
      } else {
        setTestResult({ ok: data.running ?? false, message: data.running ? "Running" : "Not running" });
      }
    } catch (e) {
      setTestResult({ ok: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  }

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
        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded">running</span>
          ) : isCfg ? (
            <span className="text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700/50 px-1.5 py-0.5 rounded">configured</span>
          ) : (
            <span className="text-[10px] bg-zinc-900 text-zinc-700 border border-zinc-800 px-1.5 py-0.5 rounded">inactive</span>
          )}
          <button
            onClick={handleTest}
            disabled={testing}
            title="Test connection"
            className="p-1 rounded text-zinc-600 hover:text-violet-400 transition-colors"
          >
            {testing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FlaskConical className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            title={confirmRemove ? "Click again to confirm" : "Remove channel"}
            className={cn(
              "p-1 rounded transition-colors",
              confirmRemove
                ? "text-red-400 hover:text-red-300 bg-red-900/30"
                : "text-zinc-700 hover:text-red-400"
            )}
          >
            {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        <ChannelRow label="Configured" value={isCfg    ? "Yes" : "No"} ok={isCfg}    />
        <ChannelRow label="Running"    value={isRunning ? "Yes" : "No"} ok={isRunning} />
        {channel.probe && (
          <ChannelRow label="Probe" value={probeOk ? `OK (${channel.probe.elapsedMs ?? "?"}ms)` : "Failed"} ok={probeOk} />
        )}
        {testResult && (
          <div className={cn(
            "mt-2 rounded px-2.5 py-1.5 border",
            testResult.ok
              ? "bg-emerald-900/20 border-emerald-800/30"
              : "bg-red-900/20 border-red-800/30"
          )}>
            <div className={cn("text-[10px] uppercase tracking-wider mb-0.5", testResult.ok ? "text-emerald-500" : "text-red-500")}>
              Test result
            </div>
            <div className={cn("text-xs", testResult.ok ? "text-emerald-400" : "text-red-400")}>
              {testResult.message}
              {testResult.elapsedMs != null && ` (${testResult.elapsedMs}ms)`}
            </div>
          </div>
        )}
        {channel.lastError && !testResult && (
          <div className="mt-2 bg-red-900/20 border border-red-800/30 rounded px-2.5 py-1.5">
            <div className="text-[10px] text-red-500 uppercase tracking-wider mb-0.5">Last error</div>
            <div className="text-xs text-red-400 break-all">{channel.lastError}</div>
          </div>
        )}
        {confirmRemove && !removing && (
          <div className="mt-2 flex items-center justify-between gap-2 bg-red-950/30 border border-red-900/40 rounded px-2.5 py-1.5">
            <span className="text-[10px] text-red-400">Remove {channel.channelType}?</span>
            <button onClick={() => setConfirmRemove(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Cancel</button>
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

// ── Add Channel Modal ─────────────────────────────────────────────────────────
function AddChannelModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [channelType, setChannelType] = useState<AddChannelType>("discord");
  const [name,        setName]        = useState("");
  const [token,       setToken]       = useState("");
  const [botToken,    setBotToken]    = useState("");
  const [appToken,    setAppToken]    = useState("");
  const [webhookUrl,  setWebhookUrl]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  // Reset fields when channel type changes
  function handleTypeChange(t: AddChannelType) {
    setChannelType(t);
    setToken(""); setBotToken(""); setAppToken(""); setWebhookUrl(""); setError("");
  }

  const isValid =
    (channelType === "discord"    && token.trim().length > 0) ||
    (channelType === "telegram"   && token.trim().length > 0) ||
    (channelType === "slack"      && botToken.trim().length > 0 && appToken.trim().length > 0) ||
    (channelType === "googlechat" && webhookUrl.trim().length > 0);

  async function handleAdd() {
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/channels/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelType, name, token, botToken, appToken, webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to add channel");
      } else {
        onAdded();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-zinc-100">Add channel</span>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Channel type selector */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Channel type</label>
            <div className="grid grid-cols-4 gap-2">
              {ADD_CHANNEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTypeChange(opt.value)}
                  className={cn(
                    "px-2 py-2 text-xs rounded-md border transition-colors",
                    channelType === opt.value
                      ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                      : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display name (optional, all types) */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Display name <span className="text-zinc-700">(optional)</span></label>
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${channelType}`}
            />
          </div>

          {/* Discord — bot token */}
          {channelType === "discord" && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Bot token</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono outline-none focus:border-violet-500"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="MTQ3OTg1..."
                type="password"
                autoFocus
              />
              <p className="text-[10px] text-zinc-600 mt-1">Discord Developer Portal → Bot → Token</p>
            </div>
          )}

          {/* Telegram — bot token */}
          {channelType === "telegram" && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Bot token</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono outline-none focus:border-violet-500"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="1234567890:ABC..."
                type="password"
                autoFocus
              />
              <p className="text-[10px] text-zinc-600 mt-1">Get from @BotFather on Telegram</p>
            </div>
          )}

          {/* Slack — bot token + app token */}
          {channelType === "slack" && (
            <>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Bot token <span className="text-zinc-600 font-mono">xoxb-</span></label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono outline-none focus:border-violet-500"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="xoxb-..."
                  type="password"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">App token <span className="text-zinc-600 font-mono">xapp-</span></label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono outline-none focus:border-violet-500"
                  value={appToken}
                  onChange={(e) => setAppToken(e.target.value)}
                  placeholder="xapp-..."
                  type="password"
                />
              </div>
              <p className="text-[10px] text-zinc-600 -mt-2">Slack API → Your App → OAuth &amp; Permissions / App-Level Tokens</p>
            </>
          )}

          {/* Google Chat — webhook URL */}
          {channelType === "googlechat" && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Webhook URL</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono outline-none focus:border-violet-500"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                autoFocus
              />
              <p className="text-[10px] text-zinc-600 mt-1">Google Chat → Space settings → Apps &amp; Integrations → Webhooks</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-950/30 border border-red-900/40 rounded px-3 py-2 text-xs text-red-400 font-mono break-all">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!isValid || saving}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5",
              isValid && !saving
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            )}
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</> : "Add channel"}
          </button>
        </div>
      </div>
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

  const [addingFor, setAddingFor]   = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const agents       = data?.agents ?? [];
  const totalEntries = agents.reduce((sum, a) => sum + a.allowlist.length, 0);

  async function handleAdd(agentId: string) {
    if (!newPattern.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res  = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, pattern: newPattern.trim() }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setSaveError(json.error ?? "Failed"); return; }
      setNewPattern("");
      setAddingFor(null);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(agentId: string, entryId: string) {
    await fetch("/api/approvals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, entryId }),
    });
    refetch();
  }

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
                <button
                  onClick={() => { setAddingFor(agent.agentId); setNewPattern(""); setSaveError(null); }}
                  className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600 hover:text-violet-400 border border-zinc-800 hover:border-violet-800 px-2 py-0.5 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add pattern
                </button>
              </div>

              {/* Add pattern row */}
              {addingFor === agent.agentId && (
                <div className="mb-2 flex items-center gap-2 bg-zinc-900 border border-violet-800/50 rounded-lg px-3 py-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <input
                    autoFocus
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd(agent.agentId);
                      if (e.key === "Escape") setAddingFor(null);
                    }}
                    placeholder="e.g. /usr/bin/python3 or sqlite3"
                    className="flex-1 bg-transparent text-xs font-mono text-zinc-200 outline-none placeholder:text-zinc-700"
                  />
                  {saveError && <span className="text-[10px] text-red-400">{saveError}</span>}
                  <button
                    onClick={() => handleAdd(agent.agentId)}
                    disabled={!newPattern.trim() || saving}
                    className="text-[10px] bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-2.5 py-1 rounded transition-colors"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                  </button>
                  <button onClick={() => setAddingFor(null)} className="text-zinc-600 hover:text-zinc-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-600">
                  <div className="col-span-4">Pattern</div>
                  <div className="col-span-4">Last command</div>
                  <div className="col-span-3 text-right">Last used</div>
                  <div className="col-span-1" />
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {agent.allowlist.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-zinc-700 text-center">No approved patterns</div>
                  ) : (
                    agent.allowlist.map((entry) => (
                      <div key={entry.id} className="grid grid-cols-12 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors group">
                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                          <Terminal className="w-3 h-3 text-zinc-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-mono text-zinc-300 truncate">{entry.pattern}</div>
                            {entry.lastResolvedPath && entry.lastResolvedPath !== entry.pattern && (
                              <div className="text-[10px] font-mono text-zinc-600 truncate">→ {entry.lastResolvedPath}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-4 flex items-center min-w-0 px-2">
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
                        <div className="col-span-1 flex items-center justify-end">
                          <button
                            onClick={() => handleDelete(agent.agentId, entry.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-700 hover:text-red-400 transition-all"
                            title="Remove pattern"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
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

// ── BackupTab ──────────────────────────────────────────────────────────────────
function BackupTab() {
  return (
    <ProGate feature="Backup & Restore">
      <BackupTabContent />
    </ProGate>
  );
}

interface RestoreResult {
  ok: boolean;
  restored: string[];
  skipped: string[];
  error?: string;
}

function BackupTabContent() {
  // Export state
  const [exporting, setExporting]   = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import state
  const [importFile, setImportFile]         = useState<File | null>(null);
  const [importing, setImporting]           = useState(false);
  const [importError, setImportError]       = useState<string | null>(null);
  const [importResult, setImportResult]     = useState<RestoreResult | null>(null);
  const [showConfirm, setShowConfirm]       = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : "clawdesk-backup.json";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImportFile(f);
    setImportError(null);
    setImportResult(null);
    setShowConfirm(false);
  }

  function handleRestoreClick() {
    if (!importFile) return;
    setShowConfirm(true);
  }

  async function handleConfirmRestore() {
    if (!importFile) return;
    setShowConfirm(false);
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await fetch("/api/backup/import", { method: "POST", body: form });
      const data = await res.json() as RestoreResult;
      if (!data.ok) throw new Error(data.error ?? "Restore failed");
      setImportResult(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Archive className="w-4 h-4 text-zinc-400" />
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Backup &amp; Restore</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Export or restore your OpenClaw and ClawDesk configuration.</p>
        </div>
      </div>

      {/* Export card */}
      <div className="border border-zinc-800 rounded-xl p-4 space-y-3 bg-zinc-900/40">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-200">Export Backup</p>
            <p className="text-xs text-zinc-500">
              Download a full backup of your OpenClaw agents, configs, and ClawDesk settings.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
            {exporting ? "Exporting…" : "Export Backup"}
          </button>
        </div>
        {exportError && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {exportError}
          </div>
        )}
      </div>

      {/* Import card */}
      <div className="border border-zinc-800 rounded-xl p-4 space-y-3 bg-zinc-900/40">
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-200">Restore from Backup</p>
          <p className="text-xs text-zinc-500">
            Restore from a previous backup file. This will overwrite your current config.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors">
            <Upload className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="text-xs text-zinc-500 truncate">
              {importFile ? importFile.name : "Choose .json backup file…"}
            </span>
            <input
              type="file"
              accept=".json"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          <button
            onClick={handleRestoreClick}
            disabled={!importFile || importing}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-100 rounded-lg transition-colors"
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {importing ? "Restoring…" : "Restore"}
          </button>
        </div>

        {/* Confirmation warning */}
        {showConfirm && (
          <div className="space-y-3 border border-amber-800/50 bg-amber-950/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                This will overwrite <span className="font-medium">openclaw.json</span>,{" "}
                <span className="font-medium">clawdesk.json</span> and all agent configs.
                Are you sure?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
              >
                Yes, restore
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {importError && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {importError}
          </div>
        )}

        {/* Success */}
        {importResult?.ok && (
          <div className="space-y-2 border border-emerald-800/50 bg-emerald-950/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-xs text-emerald-300 font-medium">Restore complete</p>
            </div>
            {importResult.restored.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Restored</p>
                <ul className="space-y-0.5">
                  {importResult.restored.map((f) => (
                    <li key={f} className="text-xs text-zinc-300 font-mono">{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {importResult.skipped.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Skipped</p>
                <ul className="space-y-0.5">
                  {importResult.skipped.map((f) => (
                    <li key={f} className="text-xs text-zinc-500 font-mono">{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
