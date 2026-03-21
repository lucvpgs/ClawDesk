import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { projects, tasks, runtimeSources, activityEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const db = getDb();
  const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const allTasks = await db.select().from(tasks);

  const enriched = allProjects.map((p) => {
    const projectTasks = allTasks.filter((t) => t.projectId === p.id);
    return {
      ...p,
      taskCount: projectTasks.length,
      taskStats: {
        todo: projectTasks.filter((t) => t.status === "todo").length,
        inProgress: projectTasks.filter((t) => t.status === "in_progress").length,
        done: projectTasks.filter((t) => t.status === "done").length,
        blocked: projectTasks.filter((t) => t.status === "blocked").length,
      },
    };
  });

  return NextResponse.json({ projects: enriched });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const db = getDb();
  const sources = await db.select().from(runtimeSources).where(eq(runtimeSources.isDefault, true)).limit(1);

  const id = generateId();
  await db.insert(projects).values({
    id,
    name,
    description: description ?? null,
    status: "active",
    runtimeSourceId: sources[0]?.id ?? null,
  });

  await db.insert(activityEvents).values({
    id: generateId(),
    eventType: "project_created",
    entityType: "project",
    entityId: id,
    summary: `Project created: "${name}"`,
    occurredAt: new Date().toISOString(),
  });

  const created = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return NextResponse.json({ project: created[0] }, { status: 201 });
}
