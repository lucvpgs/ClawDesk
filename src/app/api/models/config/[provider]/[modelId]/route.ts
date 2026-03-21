/**
 * /api/models/config/[provider]/[modelId]
 * DELETE — remove a model from agents.defaults.models and from models.providers
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string; modelId: string }> }
) {
  const { provider, modelId } = await params;
  // modelId may contain slashes (e.g. Bedrock model IDs), decode it
  const decodedModelId = decodeURIComponent(modelId);
  const key = `${provider}/${decodedModelId}`;

  try {
    const cfg = readConfig();

    // 1. Remove from agents.defaults.models
    if (cfg.agents?.defaults?.models) {
      delete cfg.agents.defaults.models[key];
    }

    // 2. Remove from models.providers[provider].models array
    const provSection = cfg.models?.providers?.[provider];
    if (provSection?.models && Array.isArray(provSection.models)) {
      provSection.models = provSection.models.filter((m: Obj) => (m.id ?? m) !== decodedModelId);
      // If no more models under this provider, remove the provider section
      if (provSection.models.length === 0) {
        delete cfg.models.providers[provider];
        // Clean up auth profile if no other models use this provider
        const remaining = Object.keys(cfg.agents?.defaults?.models ?? {})
          .some((k) => k.startsWith(`${provider}/`));
        if (!remaining) {
          if (cfg.auth?.profiles?.[`${provider}:default`]) {
            delete cfg.auth.profiles[`${provider}:default`];
          }
        }
      }
    }

    // 3. If this was the primary, clear it
    const currentModel = cfg.agents?.defaults?.model;
    if (typeof currentModel === "string" && currentModel === key) {
      cfg.agents.defaults.model = null;
    } else if (typeof currentModel === "object" && currentModel !== null) {
      if (currentModel.primary === key) currentModel.primary = null;
      currentModel.fallbacks = (currentModel.fallbacks ?? []).filter((f: string) => f !== key);
    }

    writeConfig(cfg);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
