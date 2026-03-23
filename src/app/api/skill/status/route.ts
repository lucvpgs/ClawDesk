/**
 * GET /api/skill/status
 * Returns whether the ClawDesk skill is installed and which agents have it enabled.
 * Also compares bundled vs installed version to detect if an update is needed.
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const SKILL_FILE  = path.join(homedir(), ".openclaw", "workspace", "skills", "clawdesk", "SKILL.md");
const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");

function extractVersion(content: string): string | null {
  const match = content.match(/^version:\s*["']?([^"'\n]+)["']?/m);
  return match ? match[1].trim() : null;
}

export async function GET() {
  const fileInstalled = existsSync(SKILL_FILE);

  const agentsWithSkill: string[] = [];
  let primaryAgentName: string | null = null;

  try {
    if (existsSync(CONFIG_PATH)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      const agents: any[] = config?.agents?.list ?? [];
      const primary = agents.find((a: any) => a.default) ?? agents[0];
      primaryAgentName = primary?.name ?? primary?.id ?? null;

      for (const a of agents) {
        if (Array.isArray(a.skills) && a.skills.includes("clawdesk")) {
          agentsWithSkill.push(a.name ?? a.id);
        }
      }
    }
  } catch { /* best-effort */ }

  // Compare bundled vs installed version
  let bundleVersion: string | null = null;
  let installedVersion: string | null = null;
  let needsUpdate = false;

  try {
    const skillSrc = path.join(process.cwd(), "skill", "SKILL.md");
    if (existsSync(skillSrc)) {
      bundleVersion = extractVersion(readFileSync(skillSrc, "utf-8"));
    }
    if (fileInstalled) {
      installedVersion = extractVersion(readFileSync(SKILL_FILE, "utf-8"));
    }
    needsUpdate = bundleVersion !== null && bundleVersion !== installedVersion;
  } catch { /* best-effort */ }

  return NextResponse.json({
    fileInstalled,
    agentsWithSkill,
    primaryAgentName,
    fullyInstalled: fileInstalled && agentsWithSkill.length > 0,
    bundleVersion,
    installedVersion,
    needsUpdate,
  });
}
