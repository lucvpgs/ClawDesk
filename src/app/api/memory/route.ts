/**
 * /api/memory
 * GET  ?date=YYYY-MM-DD  → read specific journal entry
 * GET  (no params)       → list all journal files, newest first
 * POST { content, date? } → write/replace entry
 * POST { append, date? }  → append to entry (agent use)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  readFileSync, writeFileSync, existsSync,
  readdirSync, mkdirSync, statSync,
} from "fs";
import { homedir } from "os";
import path from "path";

const MEMORY_DIR = path.join(homedir(), ".openclaw", "workspace", "memory");

function ensureDir() {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  ensureDir();
  const date = req.nextUrl.searchParams.get("date");

  if (date) {
    const filePath = path.join(MEMORY_DIR, `${date}.md`);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ date, content: readFileSync(filePath, "utf-8") });
  }

  // List all YYYY-MM-DD.md files, newest first
  let files: string[] = [];
  try {
    files = readdirSync(MEMORY_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();
  } catch { files = []; }

  const entries = files.map((f) => {
    const date = f.replace(".md", "");
    const filePath = path.join(MEMORY_DIR, f);
    let preview = "";
    let wordCount = 0;
    let sections: string[] = [];
    try {
      const content = readFileSync(filePath, "utf-8");
      wordCount = content.split(/\s+/).filter(Boolean).length;
      // Section headings (##)
      sections = content.split("\n")
        .filter((l) => l.startsWith("## "))
        .map((l) => l.replace("## ", "").trim());
      // First non-heading content line
      const lines = content.split("\n").map((l) => l.trim());
      const first = lines.find((l) => l && !l.startsWith("#") && !l.startsWith("---"));
      preview = first ? first.replace(/^[-*]\s*/, "").slice(0, 150) : "";
    } catch { /* empty file */ }
    const stat = statSync(filePath);
    return { date, preview, wordCount, sections, modifiedAt: stat.mtime.toISOString() };
  });

  return NextResponse.json({ entries, today: todayStr() });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  ensureDir();
  const body = await req.json() as {
    date?: string;
    content?: string;
    append?: string;
  };

  const date = body.date ?? todayStr();
  const filePath = path.join(MEMORY_DIR, `${date}.md`);

  if (body.content !== undefined) {
    writeFileSync(filePath, body.content, "utf-8");
  } else if (body.append) {
    const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    writeFileSync(filePath, existing + separator + body.append, "utf-8");
  } else {
    return NextResponse.json({ error: "content or append required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, date });
}
