/**
 * POST /api/skills/install-github
 * Installs a skill from a GitHub URL by fetching its SKILL.md and writing it
 * to ~/.openclaw/workspace/skills/<name>/SKILL.md
 *
 * Body: { url: string; agentId?: string }
 * - url: GitHub repo URL, GitHub blob URL, or raw.githubusercontent.com URL
 * - agentId: if provided, the skill name is added to that agent's skills list
 */
import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

const WORKSPACE_SKILLS = path.join(homedir(), ".openclaw", "workspace", "skills");
const CONFIG_PATH      = path.join(homedir(), ".openclaw", "openclaw.json");

// ── GitHub URL → raw content URL ─────────────────────────────────────────────

function toRawUrls(input: string): string[] {
  const url = input.trim();

  // Already a raw URL
  if (url.startsWith("https://raw.githubusercontent.com/")) {
    return [url];
  }

  // https://github.com/user/repo/blob/branch/path/to/SKILL.md
  const blobMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
  );
  if (blobMatch) {
    const [, user, repo, branch, filePath] = blobMatch;
    return [`https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`];
  }

  // https://github.com/user/repo/tree/branch/path  (directory listing)
  const treeMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?$/
  );
  if (treeMatch) {
    const [, user, repo, branch, subPath] = treeMatch;
    const base = `https://raw.githubusercontent.com/${user}/${repo}/${branch}`;
    const prefix = subPath ? `${base}/${subPath}` : base;
    return [`${prefix}/SKILL.md`];
  }

  // https://github.com/user/repo  (bare repo — try common locations on main then master)
  const repoMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?(?:\?.*)?(?:#.*)?$/);
  if (repoMatch) {
    const [, user, repo] = repoMatch;
    const base = `https://raw.githubusercontent.com/${user}/${repo}`;
    return [
      `${base}/main/SKILL.md`,
      `${base}/main/skill/SKILL.md`,
      `${base}/master/SKILL.md`,
      `${base}/master/skill/SKILL.md`,
    ];
  }

  // Unknown format — return as-is and hope for the best
  return [url];
}

// ── Minimal YAML front-matter parser ────────────────────────────────────────

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return meta;
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, agentId } = (await req.json()) as { url: string; agentId?: string };
    if (!url?.trim()) {
      return NextResponse.json({ ok: false, error: "url is required" }, { status: 400 });
    }

    const rawUrls = toRawUrls(url.trim());

    // Try each candidate URL until one succeeds
    let content: string | null = null;
    let fetchedFrom = "";
    for (const rawUrl of rawUrls) {
      const res = await fetch(rawUrl, {
        headers: { "User-Agent": "ClawDesk/1.0" },
      });
      if (res.ok) {
        content = await res.text();
        fetchedFrom = rawUrl;
        break;
      }
    }

    if (!content) {
      return NextResponse.json(
        { ok: false, error: "Could not fetch SKILL.md from the provided URL. Make sure the repo is public and contains a SKILL.md file." },
        { status: 422 }
      );
    }

    // Parse metadata
    const meta = parseFrontmatter(content);
    const skillName = meta.name ?? path.basename(fetchedFrom.replace(/\/SKILL\.md$/, ""));
    const description = meta.description ?? "";

    if (!skillName) {
      return NextResponse.json(
        { ok: false, error: "SKILL.md has no 'name' field in its front-matter." },
        { status: 422 }
      );
    }

    // Sanitize skill name (allow letters, numbers, hyphens, underscores)
    if (!/^[\w-]+$/.test(skillName)) {
      return NextResponse.json(
        { ok: false, error: `Skill name "${skillName}" contains invalid characters.` },
        { status: 422 }
      );
    }

    // Write to disk
    const skillDir  = path.join(WORKSPACE_SKILLS, skillName);
    const skillFile = path.join(skillDir, "SKILL.md");
    const alreadyExisted = existsSync(skillFile);

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(skillFile, content, "utf-8");

    // Optionally add to agent skills
    let agentPatched = false;
    if (agentId) {
      try {
        if (existsSync(CONFIG_PATH)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const config: any = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
          const agents: any[] = config?.agents?.list ?? [];
          const agent = agents.find((a: any) => a.id === agentId || a.name === agentId);
          if (agent) {
            if (!Array.isArray(agent.skills)) agent.skills = [];
            if (!agent.skills.includes(skillName)) {
              agent.skills.push(skillName);
              writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
              agentPatched = true;
            }
          }
        }
      } catch {
        // Best-effort — skill file already written, that's the important part
      }
    }

    return NextResponse.json({
      ok: true,
      skillName,
      description,
      skillFile,
      fetchedFrom,
      alreadyExisted,
      agentPatched,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
