/**
 * /api/schedules/config/[id]
 * PATCH  — update job fields (name, schedule, prompt, agentId, enabled, outputTarget, tags)
 * DELETE — remove job from jobs.json
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import type { CronJobConfig } from "../route";

const CRON_DIR  = path.join(homedir(), ".openclaw", "cron");
const CRON_FILE = path.join(CRON_DIR, "jobs.json");

interface CronFile {
  version: number;
  jobs: CronJobConfig[];
}

function readCronFile(): CronFile {
  try {
    if (!existsSync(CRON_FILE)) return { version: 1, jobs: [] };
    return JSON.parse(readFileSync(CRON_FILE, "utf-8")) as CronFile;
  } catch {
    return { version: 1, jobs: [] };
  }
}

function writeCronFile(data: CronFile) {
  mkdirSync(CRON_DIR, { recursive: true });
  writeFileSync(CRON_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// PATCH — update a job
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json() as Partial<CronJobConfig> & { deliveryTo?: string | null };
    const data = readCronFile();
    const idx  = data.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const job = data.jobs[idx];
    if (body.name         !== undefined) job.name         = body.name;
    if (body.agentId      !== undefined) job.agentId      = body.agentId;
    if (body.schedule     !== undefined) job.schedule     = body.schedule;
    if (body.prompt       !== undefined) job.prompt       = body.prompt;
    if (body.enabled      !== undefined) job.enabled      = body.enabled;
    if (body.outputTarget !== undefined) job.outputTarget = body.outputTarget;
    if (body.tags         !== undefined) job.tags         = body.tags;

    // Update delivery.to — the field OpenClaw reads for delivery destination
    if (body.deliveryTo !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = job as any;
      if (body.deliveryTo) {
        if (!raw.delivery) raw.delivery = { mode: "announce", ...(job.outputTarget ? { channel: job.outputTarget } : {}) };
        raw.delivery.to = body.deliveryTo.trim();
      } else {
        // Clearing the destination — remove delivery.to but keep rest of delivery object
        if (raw.delivery) delete raw.delivery.to;
      }
    }

    job.updatedAt = new Date().toISOString();
    data.jobs[idx] = job;
    writeCronFile(data);

    return NextResponse.json({ ok: true, job });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a job
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const data = readCronFile();
    const before = data.jobs.length;
    data.jobs = data.jobs.filter((j) => j.id !== id);
    if (data.jobs.length === before) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    writeCronFile(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
