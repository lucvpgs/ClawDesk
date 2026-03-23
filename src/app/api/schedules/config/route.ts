/**
 * /api/schedules/config
 * Reads + writes cron jobs directly from ~/.openclaw/cron/jobs.json
 * This is the source of truth, independent of gateway sync.
 *
 * GET  — list all jobs
 * POST — create a new job
 * PATCH  /api/schedules/config/[id] — update job fields
 * DELETE /api/schedules/config/[id] — remove job
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import { normalizeCronJob } from "@/lib/cron-utils";

const CRON_DIR  = path.join(homedir(), ".openclaw", "cron");
const CRON_FILE = path.join(CRON_DIR, "jobs.json");

export interface CronJobConfig {
  id: string;
  name: string;
  agentId: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  outputTarget?: string | null;
  /** delivery.to — Discord channel ID, Telegram chat ID, E.164, etc. */
  deliveryTo?: string | null;
  /** Full delivery object (OpenClaw native format) */
  delivery?: { mode: string; channel?: string; to?: string; bestEffort?: boolean } | null;
  tags?: string[];
}

interface CronFile {
  version: number;
  jobs: CronJobConfig[];
}


function readCronFile(): CronFile {
  try {
    if (!existsSync(CRON_FILE)) return { version: 1, jobs: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = JSON.parse(readFileSync(CRON_FILE, "utf-8")) as any;
    const rawJobs = Array.isArray(raw) ? raw : (raw?.jobs ?? []);
    return { version: raw?.version ?? 1, jobs: rawJobs.map(normalizeCronJob) as CronJobConfig[] };
  } catch {
    return { version: 1, jobs: [] };
  }
}

function writeCronFile(data: CronFile) {
  mkdirSync(CRON_DIR, { recursive: true });
  writeFileSync(CRON_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// GET — list all jobs from jobs.json
export async function GET() {
  const data = readCronFile();
  return NextResponse.json({ jobs: data.jobs });
}

// POST — create new job
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<CronJobConfig> & { id?: string; deliveryTo?: string | null };
    const { name, agentId, schedule, prompt, outputTarget, enabled, tags, deliveryTo } = body;

    if (!name || !agentId || !schedule || !prompt) {
      return NextResponse.json({ error: "name, agentId, schedule, prompt required" }, { status: 400 });
    }

    const data = readCronFile();
    const id = body.id ?? `cron-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (data.jobs.some((j) => j.id === id)) {
      return NextResponse.json({ error: `Job id "${id}" already exists` }, { status: 409 });
    }

    // Resolve channel type — use explicit outputTarget only; no default assumed
    const channelType = outputTarget ?? null;

    const job: CronJobConfig = {
      id,
      name: name.trim(),
      agentId,
      schedule: schedule.trim(),
      prompt: prompt.trim(),
      enabled: enabled !== false,
      createdAt: new Date().toISOString(),
      outputTarget: channelType,
      tags: tags ?? [],
      // Write delivery object in OpenClaw native format so the gateway picks it up
      ...(deliveryTo ? {
        delivery: {
          mode: "announce",
          ...(channelType ? { channel: channelType } : {}),
          to:   deliveryTo.trim(),
        },
      } : {}),
    };

    data.jobs.push(job);
    writeCronFile(data);

    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
