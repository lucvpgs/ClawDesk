import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { projects, tasks, activityEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const allowed = ["name", "description", "status"];
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  await db.update(projects).set(update).where(eq(projects.id, id));
  const updated = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

  await db.insert(activityEvents).values({
    id: generateId(),
    eventType: "project_updated",
    entityType: "project",
    entityId: id,
    summary: `Project "${updated[0].name}" updated`,
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json({ project: updated[0] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const project = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  const projectName = project[0]?.name ?? id;

  // Unlink tasks before deleting
  await db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));

  await db.insert(activityEvents).values({
    id: generateId(),
    eventType: "project_deleted",
    entityType: "project",
    entityId: id,
    summary: `Project deleted: "${projectName}"`,
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
