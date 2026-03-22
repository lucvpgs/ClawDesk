/**
 * GET /api/search?q=<query>
 * Unified search across tasks, projects, agents, and schedules.
 * Returns up to 5 results per category, scored by relevance.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tasks, projects, runtimeAgents } from "@/db/schema";
import { desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { homedir } from "os";
import { normalizeCronJob } from "@/lib/cron-utils";

const JOBS_JSON = path.join(homedir(), ".openclaw", "cron", "jobs.json");

export interface SearchResult {
  type: "task" | "project" | "agent" | "schedule";
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  url: string;
}

function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const lower = q.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(lower));
}

function readCronJobs(): Array<{ id: string; name: string; schedule: string; enabled: boolean }> {
  try {
    const raw = JSON.parse(fs.readFileSync(JOBS_JSON, "utf8"));
    const jobs = Array.isArray(raw) ? raw : (raw?.jobs ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jobs.map((j: any) => {
      const n = normalizeCronJob(j);
      return { id: n.id, name: n.name, schedule: n.schedule, enabled: n.enabled };
    });
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const db = getDb();
  const results: SearchResult[] = [];

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  allTasks
    .filter((t) => matches(q, t.title, t.description))
    .slice(0, 5)
    .forEach((t) =>
      results.push({
        type: "task",
        id: t.id,
        title: t.title,
        subtitle: t.description?.slice(0, 80) ?? "",
        meta: `${t.priority} · ${t.status}`,
        url: "/tasks",
      })
    );

  // ── Projects ───────────────────────────────────────────────────────────────
  const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
  allProjects
    .filter((p) => matches(q, p.name, p.description))
    .slice(0, 5)
    .forEach((p) =>
      results.push({
        type: "project",
        id: p.id,
        title: p.name,
        subtitle: p.description?.slice(0, 80) ?? "",
        meta: p.status,
        url: "/projects",
      })
    );

  // ── Agents ─────────────────────────────────────────────────────────────────
  const allAgents = await db.select().from(runtimeAgents);
  // Deduplicate by agentId (keep latest)
  const agentMap = new Map<string, typeof allAgents[0]>();
  allAgents.forEach((a) => {
    if (!agentMap.has(a.agentId) || (a.observedAt > (agentMap.get(a.agentId)!.observedAt))) {
      agentMap.set(a.agentId, a);
    }
  });
  [...agentMap.values()]
    .filter((a) => matches(q, a.name, a.agentId))
    .slice(0, 5)
    .forEach((a) =>
      results.push({
        type: "agent",
        id: a.agentId,
        title: a.name ?? a.agentId,
        subtitle: a.agentId,
        meta: a.model ?? "",
        url: "/agents",
      })
    );

  // ── Schedules ──────────────────────────────────────────────────────────────
  readCronJobs()
    .filter((j) => matches(q, j.name, j.id, j.schedule))
    .slice(0, 5)
    .forEach((j) =>
      results.push({
        type: "schedule",
        id: j.id,
        title: j.name,
        subtitle: j.schedule,
        meta: j.enabled ? "enabled" : "disabled",
        url: "/schedules",
      })
    );

  return NextResponse.json({ results });
}
