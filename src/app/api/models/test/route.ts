/**
 * POST /api/models/test
 * Tests whether a configured model is reachable and properly set up.
 * Returns a list of checks and an optional fix suggestion.
 */
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

const CONFIG_PATH = path.join(homedir(), ".openclaw", "openclaw.json");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>;

export interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  message?: string;
}

export interface FixInfo {
  type:
    | "ollama-not-running"
    | "ollama-model-not-pulled"
    | "ollama-daemon-env"
    | "api-key-missing"
    | "api-key-invalid"
    | "base-url-unreachable";
  title: string;
  message: string;
  autoFixable: boolean;
  command?: string;
  editableField?: {
    key: string;
    label: string;
    value: string;
    placeholder: string;
  };
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  provider: string;
  modelId: string;
  checks: CheckResult[];
  fix?: FixInfo;
}

function readConfig(): Obj {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch { return {}; }
}

// ── Ollama ────────────────────────────────────────────────────────────────────

async function testOllama(modelId: string, baseUrl: string): Promise<TestResult> {
  const start = Date.now();
  const checks: CheckResult[] = [];

  // 1. Is Ollama running?
  let ollamaRunning = false;
  let availableModels: string[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      ollamaRunning = true;
      const data = await res.json() as { models?: Array<{ name: string }> };
      availableModels = (data.models ?? []).map((m) => m.name);
    }
  } catch { /* unreachable */ }

  checks.push({
    id: "ollama-running",
    label: "Ollama is running",
    ok: ollamaRunning,
    message: ollamaRunning ? undefined : `Cannot connect to ${baseUrl}`,
  });

  // 2. Is the model pulled?
  let modelPulled = false;
  if (ollamaRunning) {
    const normalizedId = modelId.includes(":") ? modelId : `${modelId}:latest`;
    modelPulled = availableModels.some(
      (name) => name === modelId || name === normalizedId || name.split(":")[0] === modelId.split(":")[0]
    );
    checks.push({
      id: "model-pulled",
      label: `Model "${modelId}" is downloaded`,
      ok: modelPulled,
      message: modelPulled
        ? undefined
        : availableModels.length > 0
          ? `Not found locally. Available: ${availableModels.slice(0, 3).join(", ")}${availableModels.length > 3 ? "…" : ""}`
          : "No models downloaded yet",
    });
  }

  // 3. OLLAMA_API_KEY set in daemon environment
  // If this env var is absent, OpenClaw won't register Ollama as a provider at all
  const apiKeySet = !!process.env.OLLAMA_API_KEY;
  checks.push({
    id: "api-key-daemon",
    label: "OLLAMA_API_KEY set in service",
    ok: apiKeySet,
    message: apiKeySet
      ? undefined
      : "Not found in the OpenClaw gateway environment",
  });

  // Determine the most actionable fix
  let fix: FixInfo | undefined;
  if (!ollamaRunning) {
    fix = {
      type: "ollama-not-running",
      title: "Ollama is not running",
      message: `ClawDesk can't reach Ollama at ${baseUrl}. Make sure the Ollama app is open or run the command below.`,
      autoFixable: false,
      command: "ollama serve",
      editableField: {
        key: "baseUrl",
        label: "Ollama URL",
        value: baseUrl,
        placeholder: "http://localhost:11434",
      },
    };
  } else if (ollamaRunning && !modelPulled) {
    fix = {
      type: "ollama-model-not-pulled",
      title: `Model "${modelId}" not downloaded`,
      message: `The model exists in your config but hasn't been downloaded to Ollama yet.`,
      autoFixable: true,
      command: `ollama pull ${modelId}`,
    };
  } else if (!apiKeySet) {
    fix = {
      type: "ollama-daemon-env",
      title: "OLLAMA_API_KEY missing from service",
      message:
        "OpenClaw runs as a background service (LaunchAgent on macOS, systemd on Linux) and doesn't inherit your shell's environment variables. " +
        "OLLAMA_API_KEY must be added directly to the service configuration — this is the most common reason Ollama models don't work in cron jobs and scheduled tasks.",
      autoFixable: true,
    };
  }

  const ok = ollamaRunning && modelPulled && apiKeySet;
  return { ok, latencyMs: Date.now() - start, provider: "ollama", modelId, checks, fix: ok ? undefined : fix };
}

// ── API-key providers (Anthropic, OpenAI, custom) ─────────────────────────────

async function testApiKey(
  provider: string,
  modelId: string,
  baseUrl: string,
  apiKey: string,
  apiStyle: "openai" | "anthropic",
): Promise<TestResult> {
  const start = Date.now();
  const checks: CheckResult[] = [];

  const keyPresent = !!apiKey;
  checks.push({
    id: "api-key-present",
    label: "API key is configured",
    ok: keyPresent,
    message: keyPresent ? undefined : "No API key found in configuration",
  });

  if (!keyPresent) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      provider,
      modelId,
      checks,
      fix: {
        type: "api-key-missing",
        title: "API key not configured",
        message: "Add your API key for this provider.",
        autoFixable: false,
        editableField: { key: "apiKey", label: "API Key", value: "", placeholder: "sk-..." },
      },
    };
  }

  let reachable = false;
  let keyValid = false;
  let errorMsg = "";

  try {
    const url =
      apiStyle === "anthropic"
        ? `${baseUrl}/v1/messages`
        : `${baseUrl}/v1/chat/completions`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiStyle === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const body =
      apiStyle === "anthropic"
        ? JSON.stringify({ model: modelId, max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
        : JSON.stringify({ model: modelId, max_tokens: 1, messages: [{ role: "user", content: "hi" }] });

    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
    reachable = true;
    keyValid = res.status !== 401 && res.status !== 403;
    if (!keyValid) {
      const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
      errorMsg = data.error?.message ?? `HTTP ${res.status}`;
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  checks.push({
    id: "endpoint-reachable",
    label: "Endpoint is reachable",
    ok: reachable,
    message: reachable ? undefined : errorMsg,
  });
  if (reachable) {
    checks.push({
      id: "api-key-valid",
      label: "API key is valid",
      ok: keyValid,
      message: keyValid ? undefined : errorMsg,
    });
  }

  let fix: FixInfo | undefined;
  if (!reachable) {
    fix = {
      type: "base-url-unreachable",
      title: "Endpoint unreachable",
      message: `Cannot reach ${baseUrl}. Check the URL and your network connection.`,
      autoFixable: false,
      editableField: { key: "baseUrl", label: "Base URL", value: baseUrl, placeholder: "https://api.openai.com" },
    };
  } else if (!keyValid) {
    fix = {
      type: "api-key-invalid",
      title: "API key rejected",
      message: errorMsg,
      autoFixable: false,
      editableField: { key: "apiKey", label: "API Key", value: "", placeholder: "sk-..." },
    };
  }

  const ok = reachable && keyValid;
  return { ok, latencyMs: Date.now() - start, provider, modelId, checks, fix: ok ? undefined : fix };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { provider, modelId } = await req.json() as { provider: string; modelId: string };
    if (!provider || !modelId) {
      return NextResponse.json({ error: "provider and modelId required" }, { status: 400 });
    }

    const cfg = readConfig();
    const provCfg: Obj = cfg.models?.providers?.[provider] ?? {};
    const baseUrl: string = provCfg.baseUrl ?? "";
    const apiKey: string = provCfg.apiKey ?? "";

    let result: TestResult;

    switch (provider) {
      case "ollama":
        result = await testOllama(modelId, baseUrl || "http://localhost:11434");
        break;
      case "anthropic":
        result = await testApiKey(provider, modelId, baseUrl || "https://api.anthropic.com", apiKey, "anthropic");
        break;
      case "openai":
      case "custom":
      case "custom-oauth":
        result = await testApiKey(provider, modelId, baseUrl || "https://api.openai.com", apiKey, "openai");
        break;
      default:
        result = {
          ok: true,
          latencyMs: 0,
          provider,
          modelId,
          checks: [{ id: "generic", label: "Provider configured", ok: true }],
        };
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
