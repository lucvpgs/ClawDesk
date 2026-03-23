/**
 * POST /api/backup/auto
 * Runs an automatic backup and saves it to the configured folder on disk.
 * Keeps only the last 5 backups in the folder.
 */
import { NextResponse } from "next/server";
import { requirePro } from "@/server/require-pro";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { homedir } from "os";
import path from "path";

const OPENCLAW_DIR = path.join(homedir(), ".openclaw");
const CLAWDESK_JSON = path.join(OPENCLAW_DIR, "clawdesk.json");
const DEFAULT_DATA_DIR = path.join(
  homedir(),
  "Library",
  "Application Support",
  "com.vpgs.clawdesk"
);

// ── Shared helpers (mirrors export/route.ts) ──────────────────────────────────

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

interface ClawdeskJson {
  backup?: {
    schedule?: string;
    folder?: string;
    lastBackupAt?: string | null;
  };
  [key: string]: unknown;
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

function buildBundle(dataDir: string): BackupBundle {
  const openclawJson = safeRead(path.join(OPENCLAW_DIR, "openclaw.json"));
  const clawdeskJson = safeRead(path.join(OPENCLAW_DIR, "clawdesk.json"));

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
  return {
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
}

function readClawdeskJson(): ClawdeskJson {
  try {
    if (existsSync(CLAWDESK_JSON)) {
      const raw = readFileSync(CLAWDESK_JSON, "utf-8");
      return JSON.parse(raw) as ClawdeskJson;
    }
  } catch {
    // fall through
  }
  return {};
}

function writeClawdeskJson(data: ClawdeskJson): void {
  writeFileSync(CLAWDESK_JSON, JSON.stringify(data, null, 2), "utf-8");
}

function expandTilde(folderPath: string): string {
  if (folderPath.startsWith("~/")) {
    return path.join(homedir(), folderPath.slice(2));
  }
  if (folderPath === "~") {
    return homedir();
  }
  return folderPath;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  const block = requirePro(); if (block) return block;
  const clawdeskData = readClawdeskJson();
  const backupCfg = clawdeskData.backup ?? {};
  const rawFolder =
    typeof backupCfg.folder === "string" && backupCfg.folder.trim().length > 0
      ? backupCfg.folder.trim()
      : "~/ClawDesk-Backups";

  const folder = expandTilde(rawFolder);

  // Ensure folder exists
  mkdirSync(folder, { recursive: true });

  const dataDir = process.env.CLAWDESK_DATA_DIR ?? DEFAULT_DATA_DIR;
  const bundle = buildBundle(dataDir);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `clawdesk-backup-${dateStr}.json`;
  const savedTo = path.join(folder, filename);

  writeFileSync(savedTo, JSON.stringify(bundle, null, 2), "utf-8");

  // Keep only last 5 backups
  const deletedOld: string[] = [];
  try {
    const allFiles = readdirSync(folder)
      .filter((f) => /^clawdesk-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort(); // ISO date names sort alphabetically = chronologically

    if (allFiles.length > 5) {
      const toDelete = allFiles.slice(0, allFiles.length - 5);
      for (const f of toDelete) {
        const fullPath = path.join(folder, f);
        try {
          unlinkSync(fullPath);
          deletedOld.push(fullPath);
        } catch {
          // skip if we can't delete
        }
      }
    }
  } catch {
    // ignore cleanup errors
  }

  // Update lastBackupAt
  clawdeskData.backup = {
    ...backupCfg,
    lastBackupAt: now.toISOString(),
  };
  writeClawdeskJson(clawdeskData);

  return NextResponse.json({ ok: true, savedTo, deletedOld });
}
