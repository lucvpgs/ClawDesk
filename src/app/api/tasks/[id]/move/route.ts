import { NextRequest, NextResponse } from "next/server";
import { moveTask, type TaskStatus } from "@/server/task-service";

type Params = { params: Promise<{ id: string }> };

// POST /api/tasks/:id/move
// Body: { status: TaskStatus }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { status } = await req.json() as { status: TaskStatus };

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const result = await moveTask(id, status);

  if ("error" in result) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result);
}
