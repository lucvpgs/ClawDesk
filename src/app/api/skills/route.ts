/**
 * GET /api/skills
 * Returns the full skill catalog from `openclaw skills list --json`.
 */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { cliEnv } from "@/server/cli-env";
import { findOpenClawBinary } from "@/server/connector/openclaw-scan";

export interface SkillEntry {
  name: string;
  description: string;
  emoji?: string;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  source: string;
  bundled: boolean;
  homepage?: string;
  missing?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    os?: string[];
  };
}

export async function GET() {
  try {
    const bin = findOpenClawBinary() ?? "openclaw";
    const out = execSync(`${bin} skills list --json`, {
      timeout: 8_000,
      encoding: "utf-8",
      env: cliEnv(),
    });
    const data = JSON.parse(out) as { skills: SkillEntry[]; workspaceDir?: string; managedSkillsDir?: string };
    return NextResponse.json({
      skills: data.skills ?? [],
      workspaceDir: data.workspaceDir ?? null,
      managedSkillsDir: data.managedSkillsDir ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), skills: [] }, { status: 500 });
  }
}
