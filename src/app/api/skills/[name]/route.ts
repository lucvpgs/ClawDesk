/**
 * GET  /api/skills/[name]  — returns raw SKILL.md content from workspace
 * DELETE /api/skills/[name] — permanently removes a workspace skill from disk:
 *   ~/.openclaw/workspace/skills/<name>/
 * Also removes it from all agents' skills arrays in openclaw.json.
 */
import { NextRequest, NextResponse } from "next/server";
import { rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";

const WORKSPACE_SKILLS = path.join(homedir(), ".openclaw", "workspace", "skills");
const CONFIG_PATH      = path.join(homedir(), ".openclaw", "openclaw.json");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!name || !/^[\w-]+$/.test(name)) {
    return NextResponse.json({ ok: false, error: "Invalid skill name" }, { status: 400 });
  }
  const skillFile = path.join(WORKSPACE_SKILLS, name, "SKILL.md");
  if (!existsSync(skillFile)) {
    return NextResponse.json({ ok: false, error: "Skill not found in workspace" }, { status: 404 });
  }
  const content = readFileSync(skillFile, "utf-8");
  return NextResponse.json({ ok: true, name, content });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Basic safety: no path traversal
  if (!name || !/^[\w-]+$/.test(name)) {
    return NextResponse.json({ ok: false, error: "Invalid skill name" }, { status: 400 });
  }

  const skillDir = path.join(WORKSPACE_SKILLS, name);
  if (!existsSync(skillDir)) {
    return NextResponse.json({ ok: false, error: "Skill not found in workspace" }, { status: 404 });
  }

  // Delete directory recursively
  rmSync(skillDir, { recursive: true, force: true });

  // Remove from all agents in openclaw.json
  const agentsPatched: string[] = [];
  try {
    if (existsSync(CONFIG_PATH)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      const agents: any[] = config?.agents?.list ?? [];
      for (const agent of agents) {
        if (Array.isArray(agent.skills) && agent.skills.includes(name)) {
          agent.skills = agent.skills.filter((s: string) => s !== name);
          agentsPatched.push(agent.id ?? agent.name);
        }
      }
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    }
  } catch {
    // Best-effort — file already deleted
  }

  return NextResponse.json({ ok: true, skillName: name, agentsPatched });
}
