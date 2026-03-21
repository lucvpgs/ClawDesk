/**
 * /api/agents/config/[id]/file?name=SOUL.md
 * GET  — read a workspace file content
 * POST — write/update a workspace file
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");

function getAgentWorkspace(agentId: string): string | null {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    const agent = (cfg.agents?.list ?? []).find((a: { id: string }) => a.id === agentId);
    return agent?.workspace ?? null;
  } catch {
    return null;
  }
}

const ALLOWED_FILES = ["SOUL.md", "IDENTITY.md", "MEMORY.md", "HEARTBEAT.md", "BOOTSTRAP.md", "TOOLS.md", "USER.md", "AGENTS.md"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const name = req.nextUrl.searchParams.get("name");

  if (!name || !ALLOWED_FILES.includes(name)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const workspace = getAgentWorkspace(id);
  if (!workspace) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const filePath = path.join(workspace, name);
  if (!existsSync(filePath)) {
    return NextResponse.json({ content: null, exists: false });
  }

  const content = readFileSync(filePath, "utf-8");
  return NextResponse.json({ content, exists: true, path: filePath });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, content } = await req.json() as { name: string; content: string };

  if (!name || !ALLOWED_FILES.includes(name)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const workspace = getAgentWorkspace(id);
  if (!workspace) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const filePath = path.join(workspace, name);
  writeFileSync(filePath, content, "utf-8");

  return NextResponse.json({ ok: true, path: filePath });
}
