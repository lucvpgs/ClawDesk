/**
 * GET  /api/backup/schedule  — returns current auto-backup schedule config
 * PATCH /api/backup/schedule — saves schedule config (merges into clawdesk.json)
 */
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { requirePro } from "@/server/require-pro";
import { homedir } from "os";
import path from "path";

const OPENCLAW_DIR = path.join(homedir(), ".openclaw");
const CLAWDESK_JSON = path.join(OPENCLAW_DIR, "clawdesk.json");

interface BackupConfig {
  schedule: "daily" | "weekly" | "off";
  folder: string;
  lastBackupAt: string | null;
}

interface ClawdeskJson {
  backup?: Partial<BackupConfig>;
  [key: string]: unknown;
}

const DEFAULTS: BackupConfig = {
  schedule: "off",
  folder: "~/ClawDesk-Backups",
  lastBackupAt: null,
};

function readClawdeskJson(): ClawdeskJson {
  try {
    if (existsSync(CLAWDESK_JSON)) {
      const raw = readFileSync(CLAWDESK_JSON, "utf-8");
      return JSON.parse(raw) as ClawdeskJson;
    }
  } catch {
    // fall through to empty object
  }
  return {};
}

function writeClawdeskJson(data: ClawdeskJson): void {
  mkdirSync(OPENCLAW_DIR, { recursive: true });
  writeFileSync(CLAWDESK_JSON, JSON.stringify(data, null, 2), "utf-8");
}

function getBackupConfig(data: ClawdeskJson): BackupConfig {
  const saved = data.backup ?? {};
  const schedule = (saved.schedule === "daily" || saved.schedule === "weekly" || saved.schedule === "off")
    ? saved.schedule
    : DEFAULTS.schedule;
  return {
    schedule,
    folder: typeof saved.folder === "string" ? saved.folder : DEFAULTS.folder,
    lastBackupAt: typeof saved.lastBackupAt === "string" ? saved.lastBackupAt : DEFAULTS.lastBackupAt,
  };
}

export async function GET(): Promise<NextResponse> {
  const block = requirePro(); if (block) return block;
  const data = readClawdeskJson();
  const config = getBackupConfig(data);
  return NextResponse.json({ schedule: config.schedule, folder: config.folder, lastBackupAt: config.lastBackupAt });
}

interface PatchBody {
  schedule?: string;
  folder?: string;
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const block = requirePro(); if (block) return block;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = readClawdeskJson();
  const current = getBackupConfig(data);

  const updated: BackupConfig = {
    schedule: current.schedule,
    folder: current.folder,
    lastBackupAt: current.lastBackupAt,
  };

  if (typeof body.schedule === "string") {
    if (body.schedule === "daily" || body.schedule === "weekly" || body.schedule === "off") {
      updated.schedule = body.schedule;
    } else {
      return NextResponse.json({ error: "Invalid schedule value" }, { status: 400 });
    }
  }

  if (typeof body.folder === "string" && body.folder.trim().length > 0) {
    updated.folder = body.folder.trim();
  }

  data.backup = updated;
  writeClawdeskJson(data);

  return NextResponse.json({ schedule: updated.schedule, folder: updated.folder, lastBackupAt: updated.lastBackupAt });
}
