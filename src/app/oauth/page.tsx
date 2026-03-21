"use client";

/**
 * /oauth  — OAuth implicit-grant callback page.
 *
 * After the user authorizes on the provider's login page they are redirected here:
 *   http://localhost:3131/oauth?state=xxx#access_token=TOKEN
 * or (some providers):
 *   http://localhost:3131/oauth?state=xxx&access_token=TOKEN
 *
 * This page extracts the token, sends it to /api/oauth (action: complete),
 * then lets the user close the tab.
 */

import { useEffect, useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

function OAuthCallbackInner() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function run() {
      const state = searchParams.get("state");
      const oauthError = searchParams.get("error");

      if (oauthError) {
        setPhase("error");
        setMessage(searchParams.get("error_description") ?? oauthError);
        return;
      }

      // Extract access_token — prefer URL fragment (implicit grant), fall back to query param
      let token: string | null = null;
      try {
        const frag = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        token = frag.get("access_token") ?? frag.get("token");
      } catch { /* no fragment */ }
      if (!token) {
        token = searchParams.get("access_token") ?? searchParams.get("token");
      }

      if (!token) {
        setPhase("error");
        setMessage("No access_token found in the redirect URL.");
        return;
      }
      if (!state) {
        setPhase("error");
        setMessage("Missing state parameter — the OAuth flow may have expired.");
        return;
      }

      try {
        const res = await fetch("/api/oauth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", state, token }),
        });
        const data = await res.json();
        if (data.ok) {
          setPhase("success");
          setMessage("Authentication complete. You can close this tab.");
        } else {
          throw new Error(data.error ?? "Unknown error");
        }
      } catch (err) {
        setPhase("error");
        setMessage((err as Error).message);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-sm w-full text-center shadow-2xl">
        {phase === "processing" && (
          <>
            <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-4" />
            <div className="text-sm font-semibold text-zinc-100">Completing authentication…</div>
            <div className="text-xs text-zinc-500 mt-1">Storing your access token</div>
          </>
        )}

        {phase === "success" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <div className="text-sm font-semibold text-zinc-100">Authenticated!</div>
            <div className="text-xs text-zinc-400 mt-1 mb-5">{message}</div>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded transition-colors"
            >
              Close this tab
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <div className="text-sm font-semibold text-red-300">Authentication failed</div>
            <div className="text-xs text-zinc-500 mt-1">{message}</div>
            <div className="mt-4 text-[10px] text-zinc-600">
              You can close this tab and try again.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    }>
      <OAuthCallbackInner />
    </Suspense>
  );
}
