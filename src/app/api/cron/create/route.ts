import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

interface CronJob {
  id: string;
  name: string;
  agentId: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  outputTarget?: string | null;
}

interface CronFile {
  version: number;
  jobs: CronJob[];
}

const CRON_FILE = path.join(homedir(), ".openclaw", "cron", "jobs.json");

function readCronFile(): CronFile {
  try {
    const raw = readFileSync(CRON_FILE, "utf-8");
    return JSON.parse(raw) as CronFile;
  } catch {
    return { version: 1, jobs: [] };
  }
}

function writeCronFile(data: CronFile) {
  writeFileSync(CRON_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, name, agentId, schedule, prompt, outputTarget, enabled } = body as {
      taskId?: string;
      name: string;
      agentId: string;
      schedule: string;
      prompt: string;
      outputTarget?: string;
      enabled?: boolean;
    };

    // Validate required fields
    if (!name || !agentId || !schedule || !prompt) {
      return NextResponse.json({ error: "name, agentId, schedule, and prompt are required" }, { status: 400 });
    }

    // Build the cron job object
    const jobId = generateId();
    const job: CronJob = {
      id: jobId,
      name: name.trim(),
      agentId,
      schedule: schedule.trim(),
      prompt: prompt.trim(),
      enabled: enabled !== false,
      createdAt: new Date().toISOString(),
      outputTarget: outputTarget?.trim() || null,
    };

    // Write to ~/.openclaw/cron/jobs.json
    const cronFile = readCronFile();
    cronFile.jobs.push(job);
    writeCronFile(cronFile);

    // If this was promoted from a task, update the task status
    if (taskId) {
      const db = getDb();
      await db
        .update(tasks)
        .set({
          status: "promoted_to_cron",
          linkedCronJobId: jobId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, taskId));
    }

    return NextResponse.json({ ok: true, jobId, job });
  } catch (err) {
    console.error("[cron/create]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
