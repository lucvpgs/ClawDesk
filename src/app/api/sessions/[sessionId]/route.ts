/**
 * GET /api/sessions/[sessionId]?agentId=<id>
 * Returns parsed messages from the session JSONL file.
 */
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arguments?: any;
  toolCallId?: string;
  toolName?: string;
}

interface RawMessage {
  role: "user" | "assistant" | "toolResult";
  content: ContentBlock[] | string;
}

interface ParsedTurn {
  id: string;
  parentId: string | null;
  timestamp: string;
  role: "user" | "assistant" | "tool_result";
  text: string | null;
  toolCalls: Array<{ id: string; name: string; args: string }>;
  toolResults: Array<{ toolCallId: string; toolName: string; output: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const agentId = req.nextUrl.searchParams.get("agentId") ?? "main";

  // Basic safety check
  if (!/^[\w-]+$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const sessionFile = path.join(
    homedir(), ".openclaw", "agents", agentId, "sessions", `${sessionId}.jsonl`
  );

  if (!existsSync(sessionFile)) {
    return NextResponse.json({ error: "Session file not found", sessionFile }, { status: 404 });
  }

  const lines = readFileSync(sessionFile, "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  const turns: ParsedTurn[] = [];

  for (const line of lines) {
    let entry: { type: string; id?: string; parentId?: string; timestamp?: string; message?: RawMessage };
    try { entry = JSON.parse(line); } catch { continue; }

    if (entry.type !== "message" || !entry.message) continue;

    const msg  = entry.message;
    const role = msg.role;
    if (!role) continue;

    const content = Array.isArray(msg.content) ? msg.content : [];
    const textBlocks = content.filter((b) => b.type === "text");
    const toolCallBlocks = content.filter((b) => b.type === "toolCall");
    const text = textBlocks.map((b) => b.text ?? "").join("\n").trim() || null;

    const toolCalls = toolCallBlocks.map((b) => ({
      id:   b.id ?? "",
      name: b.name ?? "unknown",
      args: typeof b.arguments === "object"
        ? JSON.stringify(b.arguments, null, 2).slice(0, 400)
        : String(b.arguments ?? "").slice(0, 400),
    }));

    const toolResults = role === "toolResult"
      ? [{
          toolCallId: content[0]?.toolCallId ?? "",
          toolName:   content[0]?.toolName ?? "",
          output:     textBlocks.map((b) => b.text ?? "").join("\n").slice(0, 600),
        }]
      : [];

    turns.push({
      id:          entry.id ?? crypto.randomUUID(),
      parentId:    entry.parentId ?? null,
      timestamp:   entry.timestamp ?? "",
      role:        role === "toolResult" ? "tool_result" : role as "user" | "assistant",
      text,
      toolCalls,
      toolResults,
    });
  }

  return NextResponse.json({ sessionId, agentId, turns, total: turns.length });
}
