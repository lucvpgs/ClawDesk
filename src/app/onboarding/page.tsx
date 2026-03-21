"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Search, CheckCircle, XCircle, Loader2, ChevronRight, Bot, CalendarClock, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScanResult } from "@/types";

type Step = "scan" | "confirm" | "manual" | "connecting" | "done" | "next" | "error";
type SkillState = "idle" | "checking" | "installing" | "done" | "already" | "error";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("scan");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [form, setForm] = useState({ name: "", gatewayUrl: "", authToken: "", cliBinary: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Skill install state
  const [skillState, setSkillState] = useState<SkillState>("idle");
  const [skillAgentName, setSkillAgentName] = useState<string | null>(null);
  const [skillError, setSkillError] = useState("");

  // Auto-scan on mount
  useEffect(() => {
    setIsLoading(true);
    fetch("/api/gateway/scan")
      .then((r) => r.json())
      .then((data: ScanResult) => {
        setScanResult(data);
        if (data.found) {
          setForm({
            name: "Local OpenClaw",
            gatewayUrl: data.gatewayUrl ?? "",
            authToken: data.authToken ?? "",
            cliBinary: data.cliBinary ?? "",
          });
          setStep("confirm");
        } else {
          setStep("manual");
        }
      })
      .catch(() => setStep("manual"))
      .finally(() => setIsLoading(false));
  }, []);

  // Check skill status when "next" step is shown
  useEffect(() => {
    if (step !== "next") return;
    setSkillState("checking");
    fetch("/api/skill/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.fullyInstalled) {
          setSkillAgentName(data.agentsWithSkill?.[0] ?? null);
          setSkillState("already");
        } else {
          setSkillState("idle");
        }
      })
      .catch(() => setSkillState("idle"));
  }, [step]);

  async function connect() {
    setIsLoading(true);
    setStep("connecting");
    try {
      const res = await fetch("/api/gateway/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? "Connection failed");
        setStep("error");
      } else {
        setStep("next");
      }
    } catch (e) {
      setErrorMsg(String(e));
      setStep("error");
    } finally {
      setIsLoading(false);
    }
  }

  async function installSkill() {
    setSkillState("installing");
    setSkillError("");
    try {
      const res = await fetch("/api/skill/install", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSkillError(data.error ?? "Install failed");
        setSkillState("error");
      } else {
        setSkillAgentName(data.agentName ?? null);
        setSkillState("done");
      }
    } catch (e) {
      setSkillError(String(e));
      setSkillState("error");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8">
          <Zap className="w-5 h-5 text-violet-400" />
          <span className="text-lg font-semibold text-zinc-100">Clawdesk</span>
          <span className="text-xs text-zinc-600 ml-1">Mission Control</span>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          {/* Scanning */}
          {step === "scan" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <div className="text-sm text-zinc-400">
                Scanning for OpenClaw installation...
              </div>
            </div>
          )}

          {/* Auto-detected */}
          {step === "confirm" && scanResult?.found && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-100">
                  OpenClaw detected
                </h2>
              </div>
              <p className="text-xs text-zinc-500 mb-5">
                Found an installation on this device. Confirm to connect.
              </p>

              <div className="space-y-3 mb-5">
                <InfoRow label="Config" value={scanResult.configPath ?? ""} mono />
                <InfoRow label="Gateway" value={scanResult.gatewayUrl ?? ""} mono />
                <InfoRow
                  label="Primary agent"
                  value={scanResult.primaryAgent ?? "—"}
                />
                <InfoRow
                  label="Agents"
                  value={String(scanResult.agentCount ?? 0)}
                />
                <InfoRow
                  label="Version"
                  value={scanResult.version ?? "—"}
                  mono
                />
              </div>

              <div className="mb-4">
                <label className="text-xs text-zinc-500 mb-1 block">
                  Runtime name
                </label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Local OpenClaw"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("manual")}
                  className="flex-1 px-4 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
                >
                  Enter manually
                </button>
                <button
                  onClick={connect}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  Connect <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {/* Manual entry */}
          {step === "manual" && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-4 h-4 text-zinc-500" />
                <h2 className="text-sm font-semibold text-zinc-100">
                  Connect OpenClaw
                </h2>
              </div>
              <p className="text-xs text-zinc-500 mb-5">
                {scanResult && !scanResult.found
                  ? "No local installation found. Enter connection details manually."
                  : "Enter your OpenClaw Gateway connection details."}
              </p>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Runtime name</label>
                  <input
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="My OpenClaw"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Gateway URL</label>
                  <input
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono outline-none focus:border-violet-500"
                    value={form.gatewayUrl}
                    onChange={(e) => setForm({ ...form, gatewayUrl: e.target.value })}
                    placeholder="http://localhost:18789"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Auth token</label>
                  <input
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono outline-none focus:border-violet-500"
                    value={form.authToken}
                    onChange={(e) => setForm({ ...form, authToken: e.target.value })}
                    placeholder="your-gateway-token"
                    type="password"
                  />
                </div>
              </div>

              <button
                onClick={connect}
                disabled={!form.name || !form.gatewayUrl || !form.authToken}
                className={cn(
                  "w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5",
                  form.name && form.gatewayUrl && form.authToken
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                )}
              >
                Connect <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Connecting */}
          {step === "connecting" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <div className="text-sm text-zinc-400">
                Probing gateway and syncing runtime...
              </div>
            </div>
          )}

          {/* Done — next steps */}
          {step === "next" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <h2 className="text-sm font-semibold text-zinc-100">Connected to OpenClaw</h2>
              </div>

              <p className="text-xs text-zinc-500 -mt-2">
                Two more steps to get the most out of ClawDesk:
              </p>

              {/* Step 1 — install skill */}
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-xs font-medium text-zinc-200">Install the ClawDesk skill</span>
                  <span className="text-[9px] text-zinc-600 border border-zinc-700 px-1.5 py-0.5 rounded-full ml-auto">recommended</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Lets your agent manage tasks, schedules and models directly from chat.
                </p>

                {/* Idle / checking */}
                {(skillState === "idle" || skillState === "checking") && (
                  <button
                    onClick={installSkill}
                    disabled={skillState === "checking"}
                    className="w-full px-3 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    {skillState === "checking" ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Checking...</>
                    ) : (
                      <><Download className="w-3 h-3" /> Install skill</>
                    )}
                  </button>
                )}

                {/* Installing */}
                {skillState === "installing" && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                    Installing skill...
                  </div>
                )}

                {/* Done */}
                {(skillState === "done" || skillState === "already") && (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-emerald-400">
                      {skillState === "already" ? "Already installed" : "Skill installed"}
                      {skillAgentName && (
                        <span className="text-zinc-500"> · enabled for <span className="text-zinc-300">{skillAgentName}</span></span>
                      )}
                    </div>
                  </div>
                )}

                {/* Error */}
                {skillState === "error" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-red-400">
                      <XCircle className="w-3 h-3 shrink-0" /> Install failed
                    </div>
                    <p className="text-[10px] text-zinc-600 font-mono">{skillError}</p>
                    <button
                      onClick={installSkill}
                      className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-zinc-300"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2 — first cron */}
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-medium text-zinc-200">Set up a schedule</span>
                  <span className="text-[9px] text-zinc-600 border border-zinc-700 px-1.5 py-0.5 rounded-full ml-auto">optional</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Create a daily system check or end-of-day summary in Schedules.
                </p>
              </div>

              <button
                onClick={() => router.push("/overview")}
                className="w-full px-4 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                Go to Overview <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-zinc-100">
                  Connection failed
                </span>
              </div>
              <p className="text-xs text-red-400 font-mono bg-red-950/30 border border-red-900/40 rounded p-3">
                {errorMsg}
              </p>
              <button
                onClick={() => setStep(scanResult?.found ? "confirm" : "manual")}
                className="px-4 py-2 text-sm border border-zinc-700 rounded-lg text-zinc-300 hover:border-zinc-600 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span
        className={cn(
          "text-xs text-zinc-300 text-right truncate max-w-[260px]",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}
