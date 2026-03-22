import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";

const WORKSPACE = path.join(homedir(), ".openclaw", "workspace");

function listDir(dir: string, base = WORKSPACE): Array<{ name: string; path: string; type: "file" | "dir"; size?: number; modifiedAt?: string }> {
  try {
    const entries = readdirSync(dir);
    return entries.map((name) => {
      const full = path.join(dir, name);
      const rel = full.replace(base + "/", "");
      try {
        const stat = statSync(full);
        return {
          name,
          path: rel,
          type: stat.isDirectory() ? "dir" : "file",
          size: stat.isFile() ? stat.size : undefined,
          modifiedAt: stat.mtime.toISOString(),
        };
      } catch {
        return { name, path: rel, type: "file" as const };
      }
    });
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");
  const read = searchParams.get("read");

  if (filePath && read === "1") {
    const full = path.join(WORKSPACE, filePath);
    // Security: ensure path stays within workspace
    if (!full.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    try {
      const content = readFileSync(full, "utf-8");
      return NextResponse.json({ content });
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  }

  const dir = filePath ? path.join(WORKSPACE, filePath) : WORKSPACE;
  if (!dir.startsWith(WORKSPACE)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const entries = listDir(dir);
  return NextResponse.json({ entries, cwd: filePath ?? "" });
}

/** POST /api/docs  { path, content }  — write file back to workspace */
export async function POST(req: NextRequest) {
  try {
    const { path: filePath, content } = await req.json() as { path: string; content: string };
    if (!filePath || typeof content !== "string") {
      return NextResponse.json({ ok: false, error: "path and content are required" }, { status: 400 });
    }
    const full = path.join(WORKSPACE, filePath);
    if (!full.startsWith(WORKSPACE)) {
      return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 });
    }
    writeFileSync(full, content, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
