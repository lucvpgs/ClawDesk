import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { randomUUID } from "crypto";
import path from "path";

const APPROVALS_PATH = path.join(homedir(), ".openclaw", "exec-approvals.json");

interface AllowlistEntry {
  id: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

interface ApprovalsFile {
  version?: number;
  agents?: Record<string, { allowlist?: AllowlistEntry[] }>;
}

function readApprovals(): ApprovalsFile {
  try {
    if (!existsSync(APPROVALS_PATH)) return { version: 1, agents: {} };
    return JSON.parse(readFileSync(APPROVALS_PATH, "utf-8")) as ApprovalsFile;
  } catch {
    return { version: 1, agents: {} };
  }
}

function writeApprovals(data: ApprovalsFile) {
  mkdirSync(path.dirname(APPROVALS_PATH), { recursive: true });
  writeFileSync(APPROVALS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// GET — list all approvals
export async function GET() {
  try {
    const data = readApprovals();
    const agents: Array<{ agentId: string; allowlist: AllowlistEntry[] }> = [];
    for (const [agentId, agentData] of Object.entries(data.agents ?? {})) {
      agents.push({ agentId, allowlist: agentData.allowlist ?? [] });
    }
    return NextResponse.json({ agents, version: data.version ?? 1 });
  } catch {
    return NextResponse.json({ agents: [], version: 1, error: "exec-approvals.json not found" });
  }
}

// POST — add a pattern for an agent
// Body: { agentId: string; pattern: string }
export async function POST(req: NextRequest) {
  try {
    const { agentId, pattern } = await req.json() as { agentId: string; pattern: string };
    if (!agentId || !pattern) {
      return NextResponse.json({ error: "agentId and pattern are required" }, { status: 400 });
    }

    const data = readApprovals();
    data.agents ??= {};
    data.agents[agentId] ??= { allowlist: [] };
    data.agents[agentId].allowlist ??= [];

    // Prevent duplicates
    const exists = data.agents[agentId].allowlist!.some((e) => e.pattern === pattern);
    if (exists) {
      return NextResponse.json({ error: "Pattern already exists for this agent" }, { status: 409 });
    }

    const entry: AllowlistEntry = { id: randomUUID(), pattern };
    data.agents[agentId].allowlist!.push(entry);
    writeApprovals(data);

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a pattern by id
// Body: { agentId: string; entryId: string }
export async function DELETE(req: NextRequest) {
  try {
    const { agentId, entryId } = await req.json() as { agentId: string; entryId: string };
    if (!agentId || !entryId) {
      return NextResponse.json({ error: "agentId and entryId are required" }, { status: 400 });
    }

    const data = readApprovals();
    const list = data.agents?.[agentId]?.allowlist;
    if (!list) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const before = list.length;
    data.agents![agentId].allowlist = list.filter((e) => e.id !== entryId);
    if (data.agents![agentId].allowlist!.length === before) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    writeApprovals(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
