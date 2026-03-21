/**
 * /api/integrations
 * GET  — all configured integrations (catalog from openclaw.json + custom from integrations.json)
 * POST — connect a catalog integration OR create a new custom integration
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import {
  CATALOG, AUTH_TYPE_FIELDS, maskValue, isMasked,
  type CatalogDef, type CustomIntegration,
} from "@/lib/integrations";

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
function getPath(obj: Obj, p: string[]): Obj | null {
  let cur = obj;
  for (const k of p) { if (cur == null) return null; cur = cur[k]; }
  return cur ?? null;
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

function buildCatalogResponse(def: CatalogDef, cfg: Obj) {
  const raw = getPath(cfg, def.configPath);
  const connected = raw != null && def.connectedKey
    ? Boolean((raw as Obj)[def.connectedKey])
    : raw != null;
  const credentials: Record<string, string | boolean> = {};
  for (const f of def.fields) {
    const v = raw ? (raw as Obj)[f.key] : undefined;
    if (v === undefined || v === null) continue;
    credentials[f.key] = typeof v === "boolean" ? v : f.sensitive ? maskValue(String(v)) : String(v);
  }
  return {
    id: def.id, name: def.name, description: def.description,
    category: def.category, icon: def.icon, docsUrl: def.docsUrl ?? null,
    source: "catalog" as const, connected, enabled: raw ? (raw as Obj).enabled !== false : false,
    authType: null, fields: def.fields, credentials,
  };
}

function buildCustomResponse(c: CustomIntegration) {
  const fields = AUTH_TYPE_FIELDS[c.authType] ?? [];
  const credentials: Record<string, string | boolean> = {};
  for (const f of fields) {
    const v = c.credentials[f.key];
    if (!v) continue;
    credentials[f.key] = f.sensitive ? maskValue(v) : v;
  }
  for (const [k, v] of Object.entries(c.credentials)) {
    if (!(k in credentials)) credentials[k] = maskValue(v);
  }
  return {
    id: c.id, name: c.name, description: null,
    category: c.category, icon: "Plug", docsUrl: null,
    source: "custom" as const, connected: Object.keys(c.credentials).length > 0,
    enabled: c.enabled, authType: c.authType, fields, credentials,
    notes: c.notes ?? null,
  };
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET() {
  const cfg    = readConfig();
  const custom = readCustomFile();

  const catalogItems = CATALOG
    .map((def) => buildCatalogResponse(def, cfg))
    .filter((i) => i.connected);

  const customItems = custom.integrations.map(buildCustomResponse);

  return NextResponse.json({
    integrations: [...catalogItems, ...customItems],
    catalog: CATALOG.map((d) => ({
      id: d.id, name: d.name, description: d.description,
      category: d.category, icon: d.icon,
    })),
  });
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      source: "catalog" | "custom";
      id?: string;
      credentials?: Record<string, string | boolean>;
      name?: string; category?: string; authType?: string; notes?: string;
    };

    if (body.source === "catalog") {
      const def = CATALOG.find((d) => d.id === body.id);
      if (!def) return NextResponse.json({ error: "Unknown catalog id" }, { status: 404 });
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
        const v = body.credentials?.[f.key];
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
      return NextResponse.json({ ok: true, source: "catalog", id: def.id });
    }

    if (body.source === "custom") {
      if (!body.name || !body.category || !body.authType) {
        return NextResponse.json({ error: "name, category, authType required" }, { status: 400 });
      }
      const file = readCustomFile();
      const id   = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry: CustomIntegration = {
        id, name: body.name, category: body.category,
        authType: body.authType as CustomIntegration["authType"],
        credentials: {}, enabled: true, createdAt: new Date().toISOString(),
        notes: body.notes,
      };
      const fields = AUTH_TYPE_FIELDS[body.authType] ?? [];
      for (const f of fields) {
        const v = body.credentials?.[f.key];
        if (v && typeof v === "string" && !isMasked(v)) entry.credentials[f.key] = v;
      }
      file.integrations.push(entry);
      writeCustomFile(file);
      return NextResponse.json({ ok: true, source: "custom", id });
    }

    return NextResponse.json({ error: "source must be 'catalog' or 'custom'" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
