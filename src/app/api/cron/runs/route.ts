/**
 * /api/cron/runs
 * GET — fetch recent cron run history across all jobs via CLI
 */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const JOBS_FILE = path.join(homedir(), ".openclaw", "cron", "jobs.json");

function getJobIds(): string[] {
  try {
    if (!existsSync(JOBS_FILE)) return [];
    const raw = JSON.parse(readFileSync(JOBS_FILE, "utf-8"));
    const jobs = Array.isArray(raw) ? raw : (raw?.jobs ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jobs.filter((j: any) => j.enabled !== false).map((j: any) => j.id as string);
  } catch { return []; }
}

export async function GET() {
  const jobIds = getJobIds();
  const results: unknown[] = [];

  for (const id of jobIds.slice(0, 10)) {
    try {
      const out = execSync(`openclaw cron runs --id ${id}`, {
        timeout: 5_000,
        encoding: "utf-8",
        env: { ...process.env, HOME: homedir() },
      });
      const data = JSON.parse(out);
      if (Array.isArray(data?.entries)) {
        for (const entry of data.entries.slice(0, 3)) {
          results.push({ ...entry, jobId: id });
        }
      }
    } catch { /* job has no runs yet */ }
  }

  // Sort by startedAt desc
  results.sort((a: unknown, b: unknown) => {
    const ta = (a as { startedAt?: string }).startedAt ?? "";
    const tb = (b as { startedAt?: string }).startedAt ?? "";
    return tb.localeCompare(ta);
  });

  const failed  = results.filter((r) => (r as { status?: string }).status === "error");
  const recent  = results.slice(0, 20);

  return NextResponse.json({ runs: recent, failedCount: failed.length });
}
