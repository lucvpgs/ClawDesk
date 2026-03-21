/**
 * /api/models/config
 * GET  — read model config from openclaw.json (providers + available models + defaults)
 * POST — add a new provider + model to openclaw.json
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";
import { PROVIDER_CATALOG, modelKey } from "@/lib/model-providers";

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

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET() {
  const cfg = readConfig();
  const defaults  = cfg.agents?.defaults ?? {};
  const modelsMap: Obj = defaults.models ?? {};
  const primary   = typeof defaults.model === "string"
    ? defaults.model
    : (defaults.model?.primary ?? null);
  const fallbacks: string[] = typeof defaults.model === "object" && defaults.model !== null
    ? (defaults.model.fallbacks ?? [])
    : [];

  // Build a per-provider view from agents.defaults.models keys
  const providerMap: Record<string, { models: string[]; config: Obj }> = {};
  for (const key of Object.keys(modelsMap)) {
    const slash = key.indexOf("/");
    if (slash === -1) continue;
    const provider = key.slice(0, slash);
    const modelId  = key.slice(slash + 1);
    if (!providerMap[provider]) {
      providerMap[provider] = { models: [], config: {} };
    }
    providerMap[provider].models.push(modelId);
  }

  // Merge in models.providers config (baseUrl, auth, etc.)
  const providersConfig: Obj = cfg.models?.providers ?? {};
  for (const [pid, pcfg] of Object.entries(providersConfig)) {
    if (!providerMap[pid]) providerMap[pid] = { models: [], config: {} };
    providerMap[pid].config = pcfg as Obj;
    // Also include models defined in providers but not in defaults
    const modelsList: Obj[] = (pcfg as Obj).models ?? [];
    for (const m of modelsList) {
      const mid: string = m.id ?? m;
      if (!providerMap[pid].models.includes(mid)) {
        providerMap[pid].models.push(mid);
      }
    }
  }

  // Auth profiles
  const authProfiles: Obj = cfg.auth?.profiles ?? {};

  // Enrich with catalog info
  const providers = Object.entries(providerMap).map(([id, data]) => {
    const def = PROVIDER_CATALOG.find((p) => p.id === id);
    const profile = authProfiles[`${id}:default`] ?? null;
    const hasCredentials = profile != null
      || (data.config?.apiKey != null)
      || (data.config?.baseUrl != null)
      || id === "openai-codex"; // OAuth, always configured
    return {
      id,
      name:           def?.name ?? id,
      icon:           def?.icon ?? "⚙",
      description:    def?.description ?? null,
      authType:       def?.authType ?? "api_key",
      isKnown:        def != null,
      hasCredentials,
      baseUrl:        data.config?.baseUrl ?? def?.baseUrl ?? null,
      models:         data.models,
    };
  });

  return NextResponse.json({
    providers,
    availableModels: Object.keys(modelsMap),
    primary,
    fallbacks,
  });
}

// ── POST — add provider + model ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      provider: string;
      providerConfig?: {
        baseUrl?: string;
        apiKey?: string;
        region?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        // custom-oauth
        oauthUrl?: string;
        clientId?: string;
        accessToken?: string;
      };
      modelId: string;
      modelName?: string;
      contextWindow?: number;
      maxTokens?: number;
      setAsPrimary?: boolean;
      addAsFallback?: boolean;
    };

    const { provider, providerConfig, modelId, modelName, contextWindow, maxTokens, setAsPrimary, addAsFallback } = body;
    if (!provider || !modelId) {
      return NextResponse.json({ error: "provider and modelId required" }, { status: 400 });
    }

    const def = PROVIDER_CATALOG.find((p) => p.id === provider);
    const cfg = readConfig();

    // ── 1. agents.defaults.models ─────────────────────────────────────────────
    if (!cfg.agents) cfg.agents = {};
    if (!cfg.agents.defaults) cfg.agents.defaults = {};
    if (!cfg.agents.defaults.models) cfg.agents.defaults.models = {};
    cfg.agents.defaults.models[modelKey(provider, modelId)] = {};

    // ── 2. models.providers ───────────────────────────────────────────────────
    if (!cfg.models) cfg.models = {};
    if (!cfg.models.providers) cfg.models.providers = {};
    if (!cfg.models.providers[provider]) {
      cfg.models.providers[provider] = {
        api:  def?.api ?? "openai-completions",
        models: [],
      };
    }
    const provSection: Obj = cfg.models.providers[provider];

    // Apply provider config fields
    if (providerConfig?.baseUrl)          provSection.baseUrl = providerConfig.baseUrl;
    if (providerConfig?.apiKey)           { provSection.auth = "api_key"; provSection.apiKey = providerConfig.apiKey; }
    if (providerConfig?.region)           provSection.region = providerConfig.region;
    if (providerConfig?.accessKeyId)      provSection.accessKeyId = providerConfig.accessKeyId;
    if (providerConfig?.secretAccessKey)  provSection.secretAccessKey = providerConfig.secretAccessKey;
    if (providerConfig?.oauthUrl)         provSection.oauthUrl = providerConfig.oauthUrl;
    if (providerConfig?.clientId)         provSection.clientId = providerConfig.clientId;
    if (providerConfig?.accessToken)      { provSection.auth = "bearer"; provSection.accessToken = providerConfig.accessToken; }

    // For ollama, google — set default baseUrl if not provided
    if (!provSection.baseUrl && def?.baseUrl) provSection.baseUrl = def.baseUrl;

    // Add model entry
    if (!Array.isArray(provSection.models)) provSection.models = [];
    const existingIdx = provSection.models.findIndex((m: Obj) => (m.id ?? m) === modelId);
    const modelEntry: Obj = { id: modelId, name: modelName ?? modelId };
    if (contextWindow) modelEntry.contextWindow = contextWindow;
    if (maxTokens)     modelEntry.maxTokens     = maxTokens;
    if (existingIdx >= 0) provSection.models[existingIdx] = modelEntry;
    else                  provSection.models.push(modelEntry);

    // ── 3. auth.profiles ──────────────────────────────────────────────────────
    if (!cfg.auth) cfg.auth = {};
    if (!cfg.auth.profiles) cfg.auth.profiles = {};
    const profileKey = `${provider}:default`;
    if (!cfg.auth.profiles[profileKey]) {
      cfg.auth.profiles[profileKey] = {
        provider,
        mode: def?.authType === "oauth" ? "oauth"
            : def?.authType === "none"  ? "api_key"  // ollama uses synthetic local key
            : def?.authType === "aws"   ? "aws-sdk"
            : "api_key",
      };
    }

    // ── 4. primary / fallbacks ────────────────────────────────────────────────
    const key = modelKey(provider, modelId);
    const currentModel = cfg.agents.defaults.model;
    if (setAsPrimary) {
      const fallbackList: string[] = typeof currentModel === "object" && currentModel !== null
        ? (currentModel.fallbacks ?? [])
        : [];
      cfg.agents.defaults.model = { primary: key, fallbacks: fallbackList.filter((f: string) => f !== key) };
    } else if (addAsFallback) {
      const current = typeof currentModel === "object" && currentModel !== null
        ? currentModel
        : { primary: typeof currentModel === "string" ? currentModel : null, fallbacks: [] };
      const fallbacks: string[] = current.fallbacks ?? [];
      if (!fallbacks.includes(key)) fallbacks.push(key);
      cfg.agents.defaults.model = { ...current, fallbacks };
    }

    writeConfig(cfg);
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
