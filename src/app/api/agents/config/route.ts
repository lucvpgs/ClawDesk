/**
 * /api/agents/config
 * Reads + writes agent configs directly from ~/.openclaw/openclaw.json
 * This is the source of truth for agent configuration (model, skills, identity, etc.)
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");

interface AgentIdentity {
  name?: string;
  theme?: string;
  emoji?: string;
}

interface AgentConfig {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  agentDir?: string;
  model?: string;
  skills?: string[];
  identity?: AgentIdentity;
  tools?: Record<string, unknown>;
  subagents?: Record<string, unknown>;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: { primary?: string; fallbacks?: string[] };
      models?: Record<string, unknown>;
    };
    list?: AgentConfig[];
  };
}

function readConfig(): OpenClawConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as OpenClawConfig;
  } catch {
    return {};
  }
}

function writeConfig(cfg: OpenClawConfig) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

// GET — list all agents with full config + available models
export async function GET() {
  try {
    const cfg = readConfig();
    const agents = cfg.agents?.list ?? [];
    const defaults = cfg.agents?.defaults ?? {};
    const availableModels = Object.keys(defaults.models ?? {});
    const defaultModel = defaults.model?.primary ?? null;
    const defaultFallbacks = defaults.model?.fallbacks ?? [];

    return NextResponse.json({ agents, availableModels, defaultModel, defaultFallbacks });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — create a new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id: string; name: string; model?: string; emoji?: string; theme?: string };
    const { id, name, model, emoji, theme } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    const cfg = readConfig();
    if (!cfg.agents) cfg.agents = { list: [] };
    if (!cfg.agents.list) cfg.agents.list = [];

    // Check unique id
    if (cfg.agents.list.some((a) => a.id === id)) {
      return NextResponse.json({ error: `Agent id "${id}" already exists` }, { status: 409 });
    }

    const ocDir = path.join(homedir(), ".openclaw");
    const workspace = path.join(ocDir, "workspace", "subagents", id);
    const agentDir  = path.join(ocDir, "agents", id, "agent");

    // Create directories
    mkdirSync(workspace, { recursive: true });
    mkdirSync(agentDir, { recursive: true });

    const newAgent: AgentConfig = {
      id,
      name,
      workspace,
      agentDir,
      model: model ?? cfg.agents.defaults?.model?.primary ?? "openai-codex/gpt-5.4",
      ...(emoji || theme ? { identity: { name, ...(emoji ? { emoji } : {}), ...(theme ? { theme } : {}) } } : {}),
    };

    cfg.agents.list.push(newAgent);
    writeConfig(cfg);

    return NextResponse.json({ ok: true, agent: newAgent });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
