/**
 * POST /api/skill/install
 * Installs the ClawDesk skill into ~/.openclaw/workspace/skills/clawdesk/
 * and adds "clawdesk" to the primary agent's skills list in openclaw.json.
 */
import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const SKILL_DIR  = path.join(homedir(), ".openclaw", "workspace", "skills", "clawdesk");
const SKILL_DEST = path.join(SKILL_DIR, "SKILL.md");
const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");

export async function POST() {
  try {
    // 1. Read SKILL.md from the ClawDesk repo (next to this running app)
    const skillSrc = path.join(process.cwd(), "skill", "SKILL.md");
    if (!existsSync(skillSrc)) {
      return NextResponse.json({ ok: false, error: "skill/SKILL.md not found in ClawDesk directory" }, { status: 500 });
    }
    const skillContent = readFileSync(skillSrc, "utf-8");

    // 2. Write to ~/.openclaw/workspace/skills/clawdesk/SKILL.md
    mkdirSync(SKILL_DIR, { recursive: true });
    writeFileSync(SKILL_DEST, skillContent, "utf-8");

    // 3. Add "clawdesk" to the primary agent's skills in openclaw.json (best-effort)
    let agentPatched = false;
    let agentName: string | null = null;
    try {
      if (existsSync(CONFIG_PATH)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: any = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
        const agents: any[] = config?.agents?.list ?? [];
        const primary = agents.find((a: any) => a.default) ?? agents[0];

        if (primary) {
          if (!Array.isArray(primary.skills)) primary.skills = [];
          if (!primary.skills.includes("clawdesk")) {
            primary.skills.push("clawdesk");
            writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
            agentPatched = true;
          }
          agentName = primary.name ?? primary.id ?? null;
        }
      }
    } catch {
      // openclaw.json patch is best-effort — skill file was already written
    }

    return NextResponse.json({
      ok: true,
      skillPath: SKILL_DEST,
      agentPatched,
      agentName,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
