/**
 * /api/models/config/defaults
 * PATCH — update primary model and/or fallbacks list
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";

const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>;

function readConfig(): Obj {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch { return {}; }
}
function writeConfig(cfg: Obj) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { primary?: string; fallbacks?: string[] };
    const cfg = readConfig();
    if (!cfg.agents?.defaults) {
      return NextResponse.json({ error: "No agent defaults found" }, { status: 404 });
    }

    const current = cfg.agents.defaults.model;
    const currentPrimary: string | null = typeof current === "string" ? current
      : (typeof current === "object" && current !== null ? current.primary : null);
    const currentFallbacks: string[] = typeof current === "object" && current !== null
      ? (current.fallbacks ?? []) : [];

    cfg.agents.defaults.model = {
      primary:   body.primary   !== undefined ? body.primary   : currentPrimary,
      fallbacks: body.fallbacks !== undefined ? body.fallbacks : currentFallbacks,
    };

    writeConfig(cfg);
    return NextResponse.json({ ok: true, model: cfg.agents.defaults.model });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
