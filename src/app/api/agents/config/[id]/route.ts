/**
 * /api/agents/config/[id]
 * PATCH — update agent (model, name, skills, identity)
 * DELETE — remove agent from openclaw.json
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, readSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");

interface AgentConfig {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  agentDir?: string;
  model?: string;
  skills?: string[];
  identity?: { name?: string; theme?: string; emoji?: string };
  tools?: Record<string, unknown>;
  subagents?: Record<string, unknown>;
}

interface OpenClawConfig {
  agents?: {
    defaults?: Record<string, unknown>;
    list?: AgentConfig[];
  };
}

function readConfig(): OpenClawConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as OpenClawConfig;
}

function writeConfig(cfg: OpenClawConfig) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

// GET — full config for a single agent + workspace file list
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const cfg = readConfig();
    const agent = cfg.agents?.list?.find((a) => a.id === id);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // List workspace files
    const workspaceFiles: { name: string; path: string; exists: boolean }[] = [];
    const knownFiles = ["SOUL.md", "IDENTITY.md", "MEMORY.md", "HEARTBEAT.md", "BOOTSTRAP.md", "TOOLS.md", "USER.md", "AGENTS.md"];
    if (agent.workspace) {
      for (const f of knownFiles) {
        const fp = path.join(agent.workspace, f);
        workspaceFiles.push({ name: f, path: fp, exists: existsSync(fp) });
      }
    }

    // List installed skills (dirs in workspace/skills/)
    const skillsDir = agent.workspace ? path.join(agent.workspace, "skills") : null;
    const installedSkillDirs: string[] = [];
    if (skillsDir && existsSync(skillsDir)) {
      try {
        const { readdirSync } = await import("fs");
        installedSkillDirs.push(...readdirSync(skillsDir));
      } catch { /* empty */ }
    }

    return NextResponse.json({ agent, workspaceFiles, installedSkillDirs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — update agent fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json() as Partial<AgentConfig>;
    const cfg = readConfig();
    const list = cfg.agents?.list ?? [];
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const agent = list[idx];

    // Allowed top-level fields
    if (body.name !== undefined)   agent.name   = body.name;
    if (body.model !== undefined)  agent.model  = body.model;
    if (body.skills !== undefined) agent.skills = body.skills;

    // Identity sub-object
    if (body.identity !== undefined) {
      agent.identity = { ...(agent.identity ?? {}), ...body.identity };
    }

    // Tools sub-object
    if (body.tools !== undefined) {
      agent.tools = { ...(agent.tools ?? {}), ...body.tools };
    }

    list[idx] = agent;
    writeConfig(cfg);

    return NextResponse.json({ ok: true, agent });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove agent (cannot remove the default/main agent)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const cfg = readConfig();
    const list = cfg.agents?.list ?? [];
    const agent = list.find((a) => a.id === id);

    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (agent.default) return NextResponse.json({ error: "Cannot delete the default agent" }, { status: 403 });

    cfg.agents!.list = list.filter((a) => a.id !== id);
    writeConfig(cfg);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
