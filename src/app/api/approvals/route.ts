import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

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

export async function GET() {
  try {
    const filePath = path.join(homedir(), ".openclaw", "exec-approvals.json");
    const raw = readFileSync(filePath, "utf-8");
    const data: ApprovalsFile = JSON.parse(raw);

    const agents: Array<{
      agentId: string;
      allowlist: AllowlistEntry[];
    }> = [];

    for (const [agentId, agentData] of Object.entries(data.agents ?? {})) {
      agents.push({
        agentId,
        allowlist: agentData.allowlist ?? [],
      });
    }

    return NextResponse.json({ agents, version: data.version ?? 1 });
  } catch {
    return NextResponse.json({ agents: [], version: 1, error: "exec-approvals.json not found" });
  }
}
