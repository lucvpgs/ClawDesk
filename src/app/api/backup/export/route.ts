/**
 * GET /api/backup/export
 * Streams a JSON bundle containing all OpenClaw + ClawDesk config files.
 */
import { NextResponse } from "next/server";
import { requirePro } from "@/server/require-pro";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import path from "path";

const OPENCLAW_DIR = path.join(homedir(), ".openclaw");
const DEFAULT_DATA_DIR = path.join(
  homedir(),
  "Library",
  "Application Support",
  "com.vpgs.clawdesk"
);

interface AgentFiles {
  [agentName: string]: {
    [fileName: string]: string;
  };
}

interface BackupBundle {
  manifest: {
    version: string;
    exportedAt: string;
    platform: string;
    openclawDir: string;
    clawdeskDataDir: string;
  };
  files: {
    "openclaw.json"?: string;
    "clawdesk.json"?: string;
    agents: AgentFiles;
  };
}

function safeRead(filePath: string): string | undefined {
  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, "utf-8");
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function GET(): Promise<NextResponse> {
  const block = requirePro(); if (block) return block;
  const dataDir = process.env.CLAWDESK_DATA_DIR ?? DEFAULT_DATA_DIR;
  const openclawJson = safeRead(path.join(OPENCLAW_DIR, "openclaw.json"));
  const clawdeskJson = safeRead(path.join(OPENCLAW_DIR, "clawdesk.json"));

  // Read agents directory
  const agents: AgentFiles = {};
  const agentsDir = path.join(OPENCLAW_DIR, "agents");
  if (existsSync(agentsDir)) {
    try {
      const entries = readdirSync(agentsDir);
      for (const entry of entries) {
        const entryPath = path.join(agentsDir, entry);
        try {
          const stat = statSync(entryPath);
          if (stat.isDirectory()) {
            agents[entry] = {};
            const agentFiles = readdirSync(entryPath);
            for (const agentFile of agentFiles) {
              const agentFilePath = path.join(entryPath, agentFile);
              try {
                const fileStat = statSync(agentFilePath);
                if (fileStat.isFile()) {
                  const content = safeRead(agentFilePath);
                  if (content !== undefined) {
                    agents[entry][agentFile] = content;
                  }
                }
              } catch {
                // skip unreadable files
              }
            }
          }
        } catch {
          // skip entries we can't stat
        }
      }
    } catch {
      // agents dir unreadable — skip
    }
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const bundle: BackupBundle = {
    manifest: {
      version: "1",
      exportedAt: now.toISOString(),
      platform: process.platform,
      openclawDir: OPENCLAW_DIR,
      clawdeskDataDir: dataDir,
    },
    files: {
      ...(openclawJson !== undefined ? { "openclaw.json": openclawJson } : {}),
      ...(clawdeskJson !== undefined ? { "clawdesk.json": clawdeskJson } : {}),
      agents,
    },
  };

  const json = JSON.stringify(bundle, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="clawdesk-backup-${dateStr}.json"`,
    },
  });
}
