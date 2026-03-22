"use client";

import { useState, useRef, useEffect } from "react";
import { X, KeyRound, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  isPro: boolean;
  storedKey: string | null;
  activate: (key: string) => Promise<boolean>;
  deactivate: () => void;
}

export function LicenseModal({ open, onClose, isPro, storedKey, activate, deactivate }: Props) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput("");
      setStatus("idle");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleActivate = async () => {
    if (!input.trim()) return;
    setStatus("checking");
    const ok = await activate(input.trim());
    setStatus(ok ? "ok" : "fail");
    if (ok) setTimeout(onClose, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleActivate();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">ClawDesk Pro</h2>
              <p className="text-xs text-zinc-500">Activate your license key</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Already activated */}
          {isPro && storedKey && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-400">Pro license active</p>
                <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">{storedKey}</p>
              </div>
              <button
                onClick={() => { deactivate(); setStatus("idle"); }}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors shrink-0"
              >
                Remove
              </button>
            </div>
          )}

          {/* Pro features list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">What you unlock</p>
            <ul className="space-y-1.5">
              {[
                "💸 Cost Tracker — live spend by agent, model & day",
                "🔔 Token budget alerts — daily limit per agent",
                "🔒 Security Health Panel — auth, TLS, exposure checks",
                "📊 Token Analytics — 30-day charts, CSV export",
                "💾 Backup & Restore — configs and skills",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-zinc-300">
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">License key</label>
            <div className="relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value.toUpperCase());
                  setStatus("idle");
                }}
                onKeyDown={handleKeyDown}
                placeholder="CLWD-XXXX-XXXX-XXXX"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {/* Feedback */}
            {status === "ok" && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                License activated successfully!
              </div>
            )}
            {status === "fail" && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <XCircle className="w-3.5 h-3.5" />
                Invalid license key — please check and try again
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/50">
          <a
            href="https://clawdesk.gumroad.com/l/pro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Get a license — $39 one-time →
          </a>
          <button
            onClick={handleActivate}
            disabled={!input.trim() || status === "checking" || status === "ok"}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            {status === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Activate
          </button>
        </div>
      </div>
    </div>
  );
}
