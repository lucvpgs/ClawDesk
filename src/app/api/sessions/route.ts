/**
 * GET /api/sessions?agentId=<id>
 * Lists sessions for one or all agents via `openclaw sessions --json`.
 */
import { NextRequest, NextResponse } from "next/server";
import { cliRun } from "@/server/cli-run";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");

  try {
    const agentArgs = agentId && agentId !== "all"
      ? ["--agent", agentId]
      : ["--all-agents"];

    const out = cliRun(["sessions", ...agentArgs, "--json"], { timeout: 8_000 });

    const data = JSON.parse(out);
    const sessions = (data?.sessions ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => ({
        sessionId:    s.sessionId,
        agentId:      s.agentId,
        key:          s.key,
        updatedAt:    s.updatedAt,
        model:        s.model ?? null,
        modelProvider: s.modelProvider ?? null,
        inputTokens:  s.inputTokens ?? 0,
        outputTokens: s.outputTokens ?? 0,
        totalTokens:  s.totalTokens ?? 0,
        contextTokens: s.contextTokens ?? null,
        kind:         s.kind ?? null,
        abortedLastRun: s.abortedLastRun ?? false,
        sessionFile:  s.sessionFile ?? null,
      }))
      .sort((a: { updatedAt: number }, b: { updatedAt: number }) => b.updatedAt - a.updatedAt);

    return NextResponse.json({ sessions, stores: data?.stores ?? [] });
  } catch (err) {
    return NextResponse.json({ sessions: [], error: String(err) }, { status: 500 });
  }
}
