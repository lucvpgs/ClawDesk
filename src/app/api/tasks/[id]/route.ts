import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tasks, activityEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const allowed = ["status", "priority", "title", "description", "assignedAgentId", "completedAt", "projectId", "proof", "notes", "linkedCronJobId", "linkedSessionId", "dueAt"];
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (body.status === "done" && !body.completedAt) {
    update.completedAt = new Date().toISOString();
  }

  await db.update(tasks).set(update).where(eq(tasks.id, id));
  const updated = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

  const summary = body.status
    ? `Task "${updated[0].title}" → ${body.status}`
    : `Task "${updated[0].title}" updated`;

  await db.insert(activityEvents).values({
    id: generateId(),
    eventType: "task_updated",
    entityType: "task",
    entityId: id,
    summary,
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json({ task: updated[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const task = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  const taskTitle = task[0]?.title ?? id;

  await db.delete(tasks).where(eq(tasks.id, id));

  await db.insert(activityEvents).values({
    id: generateId(),
    eventType: "task_deleted",
    entityType: "task",
    entityId: id,
    summary: `Task deleted: "${taskTitle}"`,
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
