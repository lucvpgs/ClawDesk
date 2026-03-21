import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  runtimeSources, runtimeSourceState, runtimeAgents,
  runtimeSessions, runtimeCronJobs, runtimeChannels,
  activityEvents, tasks,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { homedir } from "os";
import { normalizeCronJob } from "@/lib/cron-utils";

const HOME           = homedir();
const OPENCLAW_JSON  = path.join(HOME, ".openclaw", "openclaw.json");
const JOBS_JSON      = path.join(HOME, ".openclaw", "cron", "jobs.json");
const MEMORY_DIR     = path.join(HOME, ".openclaw", "workspace", "memory");
const GATEWAY_URL    = "http://localhost:18789";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

async function pingGateway(): Promise<{ alive: boolean; version?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { alive: false };
    const json = await res.json();
    return { alive: true, version: json.version ?? undefined };
  } catch { return { alive: false }; }
}

function readOpenclawConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(OPENCLAW_JSON, "utf8"));
    const modelCfg = cfg?.agents?.defaults?.model;
    const primary  = typeof modelCfg === "string" ? modelCfg : modelCfg?.primary ?? null;
    const fallbacks = typeof modelCfg === "object" ? (modelCfg?.fallbacks ?? []) : [];
    const agentList = cfg?.agents?.list ?? [];
    return { primary, fallbacks, agentList };
  } catch { return { primary: null, fallbacks: [], agentList: [] }; }
}

function readCronJobs() {
  try {
    const raw = JSON.parse(fs.readFileSync(JOBS_JSON, "utf8"));
    const jobs = Array.isArray(raw) ? raw : (raw?.jobs ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jobs.map((j: any) => {
      const n = normalizeCronJob(j);
      return { id: n.id, name: n.name, schedule: n.schedule, enabled: n.enabled, agentId: n.agentId };
    });
  } catch { return []; }
}

function journalStatus() {
  const today = todayStr();
  const filePath = path.join(MEMORY_DIR, `${today}.md`);
  const exists = fs.existsSync(filePath);
  if (!exists) return { today, written: false, wordCount: 0 };
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    return { today, written: true, wordCount };
  } catch { return { today, written: false, wordCount: 0 }; }
}

export async function GET() {
  const db = getDb();

  const sources = await db
    .select().from(runtimeSources)
    .where(eq(runtimeSources.isDefault, true)).limit(1);

  const source = sources[0] ?? null;

  // Always fetch these regardless of runtime source
  const [gateway, { primary, fallbacks, agentList }, cronJobs, journal] = await Promise.all([
    pingGateway(),
    Promise.resolve(readOpenclawConfig()),
    Promise.resolve(readCronJobs()),
    Promise.resolve(journalStatus()),
  ]);

  if (!source) {
    // No runtime configured — still return useful data
    const allTasks = await db.select().from(tasks);
    const pending  = allTasks.filter((t) => t.status === "pending").length;
    const inProg   = allTasks.filter((t) => t.status === "in_progress").length;

    return NextResponse.json({
      noRuntime: true,
      gateway,
      primaryModel: primary,
      fallbacks,
      agentList,
      cronJobs,
      journal,
      taskStats: { total: allTasks.length, pending, inProgress: inProg,
        blocked: allTasks.filter((t) => t.status === "blocked").length,
        done: allTasks.filter((t) => t.status === "done").length },
      recentTasks: allTasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => {
          const pri = { urgent: 0, high: 1, medium: 2, low: 3 };
          return (pri[a.priority as keyof typeof pri] ?? 2) - (pri[b.priority as keyof typeof pri] ?? 2);
        })
        .slice(0, 5)
        .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
    });
  }

  const [state, agents, sessions, dbCronJobs, channels, activity, allTasks] = await Promise.all([
    db.select().from(runtimeSourceState)
      .where(eq(runtimeSourceState.runtimeSourceId, source.id)).limit(1),
    db.select().from(runtimeAgents)
      .where(eq(runtimeAgents.runtimeSourceId, source.id)),
    db.select().from(runtimeSessions)
      .where(eq(runtimeSessions.runtimeSourceId, source.id)),
    db.select().from(runtimeCronJobs)
      .where(eq(runtimeCronJobs.runtimeSourceId, source.id)),
    db.select().from(runtimeChannels)
      .where(eq(runtimeChannels.runtimeSourceId, source.id)),
    db.select().from(activityEvents)
      .where(eq(activityEvents.runtimeSourceId, source.id))
      .orderBy(desc(activityEvents.occurredAt)).limit(8),
    db.select().from(tasks),
  ]);

  const taskStats = {
    total: allTasks.length,
    pending: allTasks.filter((t) => t.status === "pending").length,
    inProgress: allTasks.filter((t) => t.status === "in_progress").length,
    blocked: allTasks.filter((t) => t.status === "blocked").length,
    done: allTasks.filter((t) => t.status === "done").length,
  };

  const recentTasks = allTasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const pri = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (pri[a.priority as keyof typeof pri] ?? 2) - (pri[b.priority as keyof typeof pri] ?? 2);
    })
    .slice(0, 5)
    .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));

  return NextResponse.json({
    runtimeSource: {
      id: source.id, name: source.name,
      status: state[0]?.status ?? "disconnected",
      lastSeenAt: state[0]?.lastSeenAt ?? null,
      lastSyncAt: state[0]?.lastSyncAt ?? null,
    },
    gateway,
    primaryModel: primary,
    fallbacks,
    agentList,
    agents: agents.map((a) => ({ id: a.id, agentId: a.agentId, name: a.name, model: a.model, status: a.status })),
    sessions: sessions.map((s) => ({ sessionId: s.sessionId, agentId: s.agentId, status: s.status, channel: s.channel })),
    cronJobs: cronJobs.length > 0 ? cronJobs : dbCronJobs.map((c) => ({
      id: c.jobId, name: c.name, schedule: c.schedule, enabled: c.status !== "disabled", agentId: null,
    })),
    channels: channels.map((ch) => ({ channelType: ch.channelType, status: ch.status })),
    recentActivity: activity.map((e) => ({ id: e.id, eventType: e.eventType, summary: e.summary, occurredAt: e.occurredAt })),
    taskStats,
    recentTasks,
    journal,
  });
}
