/**
 * Cost calculation utilities — shared between /api/cost and /api/cost/rates
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";

const SETTINGS_PATH = path.join(homedir(), ".openclaw", "clawdesk.json");

export interface ModelRate {
  key: string;    // matched with model.toLowerCase().includes(key)
  label: string;
  input: number;  // $ per 1M input tokens
  output: number; // $ per 1M output tokens
}

// Default rates (March 2026 pricing)
export const DEFAULT_RATES: ModelRate[] = [
  // Anthropic
  { key: "claude-opus-4",      label: "Claude Opus 4",       input: 15,    output: 75    },
  { key: "claude-sonnet-4",    label: "Claude Sonnet 4",     input: 3,     output: 15    },
  { key: "claude-haiku-3-5",   label: "Claude Haiku 3.5",    input: 0.8,   output: 4     },
  { key: "claude-3-5-sonnet",  label: "Claude 3.5 Sonnet",   input: 3,     output: 15    },
  { key: "claude-3-5-haiku",   label: "Claude 3.5 Haiku",    input: 0.8,   output: 4     },
  { key: "claude-3-opus",      label: "Claude 3 Opus",       input: 15,    output: 75    },
  { key: "claude-3-sonnet",    label: "Claude 3 Sonnet",     input: 3,     output: 15    },
  { key: "claude-3-haiku",     label: "Claude 3 Haiku",      input: 0.25,  output: 1.25  },
  // OpenAI
  { key: "gpt-4o-mini",        label: "GPT-4o Mini",         input: 0.15,  output: 0.6   },
  { key: "gpt-4o",             label: "GPT-4o",              input: 2.5,   output: 10    },
  { key: "gpt-4-turbo",        label: "GPT-4 Turbo",         input: 10,    output: 30    },
  { key: "gpt-4.1-mini",       label: "GPT-4.1 Mini",        input: 0.4,   output: 1.6   },
  { key: "gpt-4.1",            label: "GPT-4.1",             input: 2,     output: 8     },
  { key: "o4-mini",            label: "OpenAI o4-mini",      input: 1.1,   output: 4.4   },
  { key: "o3",                 label: "OpenAI o3",           input: 10,    output: 40    },
  // Google
  { key: "gemini-2.5-pro",     label: "Gemini 2.5 Pro",      input: 1.25,  output: 10    },
  { key: "gemini-2.0-flash",   label: "Gemini 2.0 Flash",    input: 0.1,   output: 0.4   },
  { key: "gemini-1.5-pro",     label: "Gemini 1.5 Pro",      input: 1.25,  output: 5     },
  { key: "gemini-1.5-flash",   label: "Gemini 1.5 Flash",    input: 0.075, output: 0.3   },
  // DeepSeek
  { key: "deepseek-r2",        label: "DeepSeek R2",         input: 0.55,  output: 2.19  },
  { key: "deepseek-v3",        label: "DeepSeek V3",         input: 0.27,  output: 1.1   },
  { key: "deepseek",           label: "DeepSeek",            input: 0.14,  output: 0.28  },
  // Ollama / local
  { key: "ollama",             label: "Ollama (local)",      input: 0,     output: 0     },
];

export function readRateOverrides(): Record<string, { input: number; output: number }> {
  try {
    if (!existsSync(SETTINGS_PATH)) return {};
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    return raw?.modelRates ?? {};
  } catch { return {}; }
}

export function writeRateOverrides(overrides: Record<string, { input: number; output: number }>) {
  try {
    let existing: Record<string, unknown> = {};
    if (existsSync(SETTINGS_PATH)) {
      existing = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    }
    existing.modelRates = overrides;
    writeFileSync(SETTINGS_PATH, JSON.stringify(existing, null, 2), "utf-8");
  } catch { /* best effort */ }
}

export function getMergedRates(): ModelRate[] {
  const overrides = readRateOverrides();
  return DEFAULT_RATES.map((r) => ({
    ...r,
    ...(overrides[r.key] ?? {}),
  }));
}

// Find best matching rate — longer keys match first (more specific)
export function findRate(model: string | null, rates: ModelRate[]): ModelRate | null {
  if (!model) return null;
  const m = model.toLowerCase();
  const sorted = [...rates].sort((a, b) => b.key.length - a.key.length);
  return sorted.find((r) => m.includes(r.key.toLowerCase())) ?? null;
}

export function calcCost(inputTokens: number, outputTokens: number, rate: ModelRate | null): number {
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}
