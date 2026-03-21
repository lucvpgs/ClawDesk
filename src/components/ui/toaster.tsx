"use client";

import { useEffect, useState } from "react";
import { subscribeToasts } from "@/lib/toast";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";
type Toast = { id: string; message: string; type: ToastType };

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsub = subscribeToasts(setToasts);
    return () => { unsub(); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2" style={{ maxWidth: 320 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-xs text-zinc-100 flex items-center gap-2 shadow-xl"
        >
          {t.type === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          {t.type === "error"   && <XCircle       className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          {t.type === "info"    && <Info          className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
          {t.type === "warning" && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
