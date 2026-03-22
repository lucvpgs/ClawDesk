import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { taskComments } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

// GET /api/tasks/[id]/comments
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: taskId } = await params;
  const db = getDb();
  const comments = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));
  return NextResponse.json({ comments });
}

// POST /api/tasks/[id]/comments
// Body: { body: string; author?: string }
export async function POST(req: NextRequest, { params }: Params) {
  const { id: taskId } = await params;
  const { body, author = "user" } = await req.json() as { body: string; author?: string };

  if (!body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const db = getDb();
  const id = generateId();
  await db.insert(taskComments).values({
    id,
    taskId,
    author,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  });

  const created = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.id, id))
    .limit(1);

  return NextResponse.json({ comment: created[0] }, { status: 201 });
}
