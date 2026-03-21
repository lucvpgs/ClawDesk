/**
 * GET /api/schedules/[id]/runs
 * Fetch run history for a specific cron job via CLI.
 */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { homedir } from "os";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ runs: [], error: "Missing job id" }, { status: 400 });
  }

  try {
    const out = execSync(`openclaw cron runs --id ${id} --limit 10`, {
      timeout: 8_000,
      encoding: "utf-8",
      env: { ...process.env, HOME: homedir() },
    });

    const data = JSON.parse(out);
    const entries = Array.isArray(data?.entries) ? data.entries : [];

    // Normalise entries — compute durationMs if possible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs = entries.map((e: any) => {
      const startedAt: string | null   = e.startedAt   ?? e.startAt   ?? null;
      const finishedAt: string | null  = e.finishedAt  ?? e.finishAt  ?? e.completedAt ?? null;
      const durationMs: number | null  =
        startedAt && finishedAt
          ? new Date(finishedAt).getTime() - new Date(startedAt).getTime()
          : (e.durationMs ?? e.duration ?? null);

      const output: string | null = e.output ?? e.result ?? e.response ?? null;

      return {
        id:         e.id ?? e.runId ?? null,
        status:     e.status ?? "unknown",
        startedAt,
        finishedAt,
        durationMs,
        output:     typeof output === "string" ? output.slice(0, 300) : null,
        error:      e.error ?? null,
      };
    });

    return NextResponse.json({ runs, total: data?.total ?? runs.length });
  } catch {
    // Job has no runs yet or CLI error — return empty
    return NextResponse.json({ runs: [], total: 0 });
  }
}
