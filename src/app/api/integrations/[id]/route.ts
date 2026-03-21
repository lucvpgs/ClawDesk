/**
 * /api/integrations/[id]
 * PATCH  — update catalog item (openclaw.json) OR custom item (integrations.json)
 * DELETE — remove catalog section OR delete custom entry
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import { CATALOG, AUTH_TYPE_FIELDS, isMasked, type CustomIntegration } from "@/lib/integrations";

const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");
const CUSTOM_PATH = path.join(homedir(), ".openclaw", "integrations.json");
const OC_DIR      = path.join(homedir(), ".openclaw");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>;

function readConfig(): Obj {
  try { return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")); } catch { return {}; }
}
function writeConfig(cfg: Obj) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

interface CustomFile { version: number; integrations: CustomIntegration[]; }
function readCustomFile(): CustomFile {
  try {
    if (!existsSync(CUSTOM_PATH)) return { version: 1, integrations: [] };
    return JSON.parse(readFileSync(CUSTOM_PATH, "utf-8"));
  } catch { return { version: 1, integrations: [] }; }
}
function writeCustomFile(data: CustomFile) {
  mkdirSync(OC_DIR, { recursive: true });
  writeFileSync(CUSTOM_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function deletePath(obj: Obj, p: string[]): void {
  let cur = obj;
  for (let i = 0; i < p.length - 1; i++) { if (!cur[p[i]]) return; cur = cur[p[i]]; }
  delete cur[p[p.length - 1]];
}

// PATCH
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body   = await req.json() as Record<string, unknown>;

  const def = CATALOG.find((d) => d.id === id);
  if (def) {
    try {
      const cfg = readConfig();
      let section = cfg;
      for (let i = 0; i < def.configPath.length - 1; i++) {
        if (!section[def.configPath[i]]) section[def.configPath[i]] = {};
        section = section[def.configPath[i]];
      }
      const lastKey = def.configPath[def.configPath.length - 1];
      if (!section[lastKey]) section[lastKey] = {};
      const target = section[lastKey];
      for (const f of def.fields) {
        const v = body[f.key];
        if (v === undefined) continue;
        if (typeof v === "string" && isMasked(v)) continue;
        target[f.key] = v;
      }
      if (def.pluginPath) {
        let p = cfg;
        for (let i = 0; i < def.pluginPath.length - 1; i++) {
          if (!p[def.pluginPath[i]]) p[def.pluginPath[i]] = {};
          p = p[def.pluginPath[i]];
        }
        p[def.pluginPath[def.pluginPath.length - 1]] = { enabled: target.enabled !== false };
      }
      writeConfig(cfg);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  const file = readCustomFile();
  const idx  = file.integrations.findIndex((c) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  const entry = file.integrations[idx];
  if (body.name     !== undefined) entry.name     = String(body.name);
  if (body.category !== undefined) entry.category = String(body.category);
  if (body.enabled  !== undefined) entry.enabled  = Boolean(body.enabled);
  if (body.notes    !== undefined) entry.notes    = String(body.notes);
  entry.updatedAt = new Date().toISOString();
  const fields = AUTH_TYPE_FIELDS[entry.authType] ?? [];
  for (const f of fields) {
    const v = body[f.key];
    if (v === undefined) continue;
    if (typeof v === "string" && isMasked(v)) continue;
    if (typeof v === "string") entry.credentials[f.key] = v;
  }
  file.integrations[idx] = entry;
  writeCustomFile(file);
  return NextResponse.json({ ok: true });
}

// DELETE
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const def = CATALOG.find((d) => d.id === id);
  if (def) {
    try {
      const cfg = readConfig();
      deletePath(cfg, def.configPath);
      if (def.pluginPath) deletePath(cfg, def.pluginPath);
      writeConfig(cfg);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }
  const file = readCustomFile();
  const before = file.integrations.length;
  file.integrations = file.integrations.filter((c) => c.id !== id);
  if (file.integrations.length === before) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }
  writeCustomFile(file);
  return NextResponse.json({ ok: true });
}
