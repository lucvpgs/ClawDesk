/**
 * POST /api/backup/import
 * Accepts a multipart form upload of a JSON backup bundle and restores config files.
 * Does NOT restore clawdesk.db — too risky.
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const OPENCLAW_DIR = path.join(homedir(), ".openclaw");

interface AgentFiles {
  [agentName: string]: {
    [fileName: string]: string;
  };
}

interface BackupBundle {
  manifest: {
    version: string;
    exportedAt: string;
    platform?: string;
    openclawDir?: string;
    clawdeskDataDir?: string;
  };
  files: {
    "openclaw.json"?: string;
    "clawdesk.json"?: string;
    agents?: AgentFiles;
  };
}

function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to parse form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read uploaded file" }, { status: 400 });
  }

  let bundle: BackupBundle;
  try {
    bundle = JSON.parse(text) as BackupBundle;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON in backup file" }, { status: 400 });
  }

  // Validate manifest
  if (!bundle.manifest?.version) {
    return NextResponse.json(
      { ok: false, error: "Invalid backup file: missing manifest.version" },
      { status: 400 }
    );
  }

  if (!bundle.files) {
    return NextResponse.json(
      { ok: false, error: "Invalid backup file: missing files section" },
      { status: 400 }
    );
  }

  const restored: string[] = [];
  const skipped: string[] = ["clawdesk.db (skipped — manual restore required)"];

  ensureDir(OPENCLAW_DIR);

  // Restore openclaw.json
  if (bundle.files["openclaw.json"] !== undefined) {
    try {
      writeFileSync(
        path.join(OPENCLAW_DIR, "openclaw.json"),
        bundle.files["openclaw.json"],
        "utf-8"
      );
      restored.push("openclaw.json");
    } catch {
      skipped.push("openclaw.json (write failed)");
    }
  }

  // Restore clawdesk.json
  if (bundle.files["clawdesk.json"] !== undefined) {
    try {
      writeFileSync(
        path.join(OPENCLAW_DIR, "clawdesk.json"),
        bundle.files["clawdesk.json"],
        "utf-8"
      );
      restored.push("clawdesk.json");
    } catch {
      skipped.push("clawdesk.json (write failed)");
    }
  }

  // Restore agent configs
  const agents = bundle.files.agents ?? {};
  for (const [agentName, agentFiles] of Object.entries(agents)) {
    // Basic path safety — reject names with path separators
    if (agentName.includes("/") || agentName.includes("\\") || agentName === ".." || agentName === ".") {
      skipped.push(`agents/${agentName} (unsafe name)`);
      continue;
    }
    const agentDir = path.join(OPENCLAW_DIR, "agents", agentName);
    try {
      ensureDir(agentDir);
      for (const [fileName, content] of Object.entries(agentFiles)) {
        if (fileName.includes("/") || fileName.includes("\\") || fileName === ".." || fileName === ".") {
          skipped.push(`agents/${agentName}/${fileName} (unsafe name)`);
          continue;
        }
        writeFileSync(path.join(agentDir, fileName), content, "utf-8");
        restored.push(`agents/${agentName}/${fileName}`);
      }
    } catch {
      skipped.push(`agents/${agentName} (write failed)`);
    }
  }

  return NextResponse.json({ ok: true, restored, skipped });
}
