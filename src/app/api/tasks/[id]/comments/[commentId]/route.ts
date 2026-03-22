import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { taskComments } from "@/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string; commentId: string }> };

// DELETE /api/tasks/[id]/comments/[commentId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { commentId } = await params;
  const db = getDb();
  await db.delete(taskComments).where(eq(taskComments.id, commentId));
  return NextResponse.json({ ok: true });
}
