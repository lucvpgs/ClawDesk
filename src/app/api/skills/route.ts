/**
 * GET /api/skills
 * Returns the full skill catalog from `openclaw skills list --json`.
 *
 * NOTE: openclaw writes JSON to stderr (not stdout) for some sub-commands.
 * We capture stdio: "pipe" and try stdout first, then stderr.
 */
import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
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
    const result = spawnSync(bin, ["skills", "list", "--json"], {
      timeout: 8_000,
      encoding: "utf-8",
      env: cliEnv(),
    });

    // openclaw writes JSON to stderr for this command
    const raw = (result.stdout?.trim() || result.stderr?.trim()) ?? "";
    if (!raw) {
      const spawnErr = result.error ? String(result.error) : `exit code ${result.status}`;
      return NextResponse.json({ error: spawnErr, skills: [] }, { status: 500 });
    }

    const data = JSON.parse(raw) as { skills: SkillEntry[]; workspaceDir?: string; managedSkillsDir?: string };
    return NextResponse.json({
      skills: data.skills ?? [],
      workspaceDir: data.workspaceDir ?? null,
      managedSkillsDir: data.managedSkillsDir ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), skills: [] }, { status: 500 });
  }
}
