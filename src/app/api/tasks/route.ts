import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tasks, activityEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const db = getDb();
  const allTasks = await db
    .select()
    .from(tasks)
    .orderBy(desc(tasks.createdAt));

  return NextResponse.json({ tasks: allTasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, priority = "medium", status = "todo", projectId, assignedAgentId } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const db = getDb();

  const id = generateId();
  await db.insert(tasks).values({
    id,
    title,
    description: description ?? null,
    priority,
    status,
    projectId: projectId ?? null,
    assignedAgentId: assignedAgentId ?? null,
  });

  await db.insert(activityEvents).values({
    id: generateId(),
    eventType: "task_created",
    entityType: "task",
    entityId: id,
    summary: `Task created: "${title}"`,
    occurredAt: new Date().toISOString(),
  });

  const created = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return NextResponse.json({ task: created[0] }, { status: 201 });
}
