/**
 * /api/schedules
 * GET  — merged view: jobs.json (config) + DB runtime snapshot (status, lastRunAt, nextRunAt)
 * POST — trigger run now via gateway
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";
import { getDb } from "@/db";
import { runtimeCronJobs, runtimeSources, activityEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { normalizeCronJob } from "@/lib/cron-utils";
import { execSync } from "child_process";
import { cliEnv } from "@/server/cli-env";

const CRON_FILE = path.join(homedir(), ".openclaw", "cron", "jobs.json");

function readJobsFile(): ReturnType<typeof normalizeCronJob>[] {
  try {
    if (!existsSync(CRON_FILE)) return [];
    const raw = JSON.parse(readFileSync(CRON_FILE, "utf-8"));
    const jobs = Array.isArray(raw) ? raw : (raw?.jobs ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jobs.map((j: any) => normalizeCronJob(j));
  } catch {
    return [];
  }
}

export async function GET() {
  // 1. Read config from jobs.json (source of truth)
  const configJobs = readJobsFile();

  // 2. Try to get runtime snapshot from DB (best-effort)
  let runtimeMap: Record<string, { status: string | null; lastRunAt: string | null; nextRunAt: string | null }> = {};
  try {
    const db = getDb();
    const sources = await db
      .select()
      .from(runtimeSources)
      .where(eq(runtimeSources.isDefault, true))
      .limit(1);

    if (sources[0]) {
      const dbJobs = await db
        .select()
        .from(runtimeCronJobs)
        .where(eq(runtimeCronJobs.runtimeSourceId, sources[0].id));

      for (const j of dbJobs) {
        runtimeMap[j.jobId] = {
          status:    j.status,
          lastRunAt: j.lastRunAt,
          nextRunAt: j.nextRunAt,
        };
      }
    }
  } catch {
    // No runtime — still return config jobs
  }

  // 3. Merge: config job + runtime data
  const jobs = configJobs.map((j) => {
    const rt = runtimeMap[j.id] ?? null;
    return {
      // config fields
      id:           j.id,
      jobId:        j.id,
      name:         j.name ?? null,
      agentId:      j.agentId ?? null,
      schedule:     j.schedule ?? null,
      prompt:       j.prompt ?? null,
      enabled:      j.enabled !== false,
      createdAt:    j.createdAt ?? null,
      updatedAt:    j.updatedAt ?? null,
      outputTarget: j.outputTarget ?? null,
      deliveryTo:   j.deliveryTo ?? null,
      tags:         j.tags ?? [],
      // runtime fields (may be null if no sync)
      status:       rt?.status ?? (j.enabled !== false ? "active" : "disabled"),
      lastRunAt:    rt?.lastRunAt ?? null,
      nextRunAt:    rt?.nextRunAt ?? (j as unknown as { nextRunAt?: string }).nextRunAt ?? null,
    };
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, jobId } = body;

  if (action !== "run") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  // Trigger directly via CLI — no runtime source needed
  try {
    const out = execSync(`openclaw cron run ${jobId}`, {
      timeout: 10_000,
      encoding: "utf-8",
      env: cliEnv(),
    });
    const result = JSON.parse(out);

    // Best-effort activity log (only if runtime DB is configured)
    try {
      const db = getDb();
      const sources = await db.select().from(runtimeSources)
        .where(eq(runtimeSources.isDefault, true)).limit(1);
      if (sources[0]) {
        await db.insert(activityEvents).values({
          id: generateId(),
          runtimeSourceId: sources[0].id,
          eventType: "cron.run",
          entityType: "cron",
          entityId: jobId,
          summary: `Cron job ${jobId} triggered manually`,
          occurredAt: new Date().toISOString(),
        });
      }
    } catch { /* no runtime DB — skip */ }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
