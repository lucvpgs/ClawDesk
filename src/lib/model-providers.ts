/**
 * OpenClaw model provider catalog.
 * Defines supported providers, their config structure, and preset model lists.
 */

export interface ProviderDef {
  id: string;
  name: string;
  description: string;
  icon: string;              // emoji
  authType: "none" | "api_key" | "oauth" | "aws";
  api: string;               // openclaw api type
  baseUrl?: string;          // default base URL (for ollama, google, custom)
  fields: ProviderField[];
  presetModels: PresetModel[];
  freeTextModel: boolean;    // allow typing any model ID
  docsUrl?: string;
}

export interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  default?: string;
}

export interface PresetModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  description?: string;
  reasoning?: boolean;
}

export const PROVIDER_CATALOG: ProviderDef[] = [
  {
    id: "ollama",
    name: "Ollama",
    description: "Local models running on your machine",
    icon: "🦙",
    authType: "none",
    api: "ollama",
    baseUrl: "http://localhost:11434",
    fields: [
      { key: "baseUrl", label: "Ollama URL", type: "url",
        placeholder: "http://localhost:11434", default: "http://localhost:11434",
        hint: "Default port is 11434. Use a remote host if Ollama runs on another machine.", required: true },
    ],
    freeTextModel: true,
    presetModels: [
      { id: "qwen3:8b",         name: "Qwen 3 8B",          contextWindow: 32768 },
      { id: "qwen3:14b",        name: "Qwen 3 14B",         contextWindow: 32768 },
      { id: "qwen3:32b",        name: "Qwen 3 32B",         contextWindow: 32768, reasoning: true },
      { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B",  contextWindow: 32768 },
      { id: "llama3.3:70b",     name: "Llama 3.3 70B",      contextWindow: 131072 },
      { id: "llama3.2:3b",      name: "Llama 3.2 3B",       contextWindow: 131072 },
      { id: "mistral:7b",       name: "Mistral 7B",          contextWindow: 32768 },
      { id: "deepseek-r1:14b",  name: "DeepSeek R1 14B",    contextWindow: 65536, reasoning: true },
      { id: "gemma3:12b",       name: "Gemma 3 12B",         contextWindow: 131072 },
      { id: "phi4:14b",         name: "Phi 4 14B",           contextWindow: 16384 },
    ],
    docsUrl: "https://ollama.com/library",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models via direct API key",
    icon: "✦",
    authType: "api_key",
    api: "anthropic-messages",
    fields: [
      { key: "apiKey", label: "API Key", type: "password",
        placeholder: "sk-ant-api03-...",
        hint: "From console.anthropic.com → API Keys", required: true },
    ],
    freeTextModel: false,
    presetModels: [
      { id: "claude-opus-4-6",    name: "Claude Opus 4.6",    contextWindow: 200000, maxTokens: 32000, reasoning: true },
      { id: "claude-sonnet-4-6",  name: "Claude Sonnet 4.6",  contextWindow: 200000, maxTokens: 16000 },
      { id: "claude-sonnet-4-5",  name: "Claude Sonnet 4.5",  contextWindow: 200000, maxTokens: 8096 },
      { id: "claude-haiku-4-5",   name: "Claude Haiku 4.5",   contextWindow: 200000, maxTokens: 8096, description: "Fast & affordable" },
    ],
    docsUrl: "https://docs.anthropic.com/en/api",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models via OpenAI API key",
    icon: "◆",
    authType: "api_key",
    api: "openai-completions",
    fields: [
      { key: "apiKey", label: "API Key", type: "password",
        placeholder: "sk-...",
        hint: "From platform.openai.com → API Keys", required: true },
    ],
    freeTextModel: false,
    presetModels: [
      { id: "gpt-4o",       name: "GPT-4o",        contextWindow: 128000, maxTokens: 16384 },
      { id: "gpt-4o-mini",  name: "GPT-4o Mini",   contextWindow: 128000, maxTokens: 16384, description: "Fast & cheap" },
      { id: "gpt-4-turbo",  name: "GPT-4 Turbo",   contextWindow: 128000, maxTokens: 4096 },
      { id: "o1",           name: "o1",             contextWindow: 200000, reasoning: true },
      { id: "o3-mini",      name: "o3-mini",        contextWindow: 200000, reasoning: true, description: "Fast reasoning" },
    ],
    docsUrl: "https://platform.openai.com/docs/models",
  },
  {
    id: "openai-codex",
    name: "OpenAI Codex",
    description: "Claude Code / OpenAI Codex via OAuth (already configured)",
    icon: "⬡",
    authType: "oauth",
    api: "openai-codex-responses",
    fields: [],   // OAuth is pre-configured, no extra fields
    freeTextModel: false,
    presetModels: [
      { id: "gpt-5.4",   name: "GPT-5.4",    contextWindow: 200000 },
      { id: "gpt-4o",    name: "GPT-4o",      contextWindow: 128000 },
    ],
    docsUrl: "https://docs.openclaw.ai/providers/openai-codex",
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini models via Google AI API key",
    icon: "◈",
    authType: "api_key",
    api: "openai-completions",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    fields: [
      { key: "apiKey", label: "API Key", type: "password",
        placeholder: "AIza...",
        hint: "From aistudio.google.com → Get API Key", required: true },
    ],
    freeTextModel: false,
    presetModels: [
      { id: "gemini-2.0-flash",       name: "Gemini 2.0 Flash",       contextWindow: 1048576, description: "Fast multimodal" },
      { id: "gemini-2.0-flash-lite",  name: "Gemini 2.0 Flash Lite",  contextWindow: 1048576, description: "Fastest & cheapest" },
      { id: "gemini-1.5-pro",         name: "Gemini 1.5 Pro",         contextWindow: 2097152 },
      { id: "gemini-1.5-flash",       name: "Gemini 1.5 Flash",       contextWindow: 1048576 },
    ],
    docsUrl: "https://ai.google.dev/gemini-api",
  },
  {
    id: "amazon-bedrock",
    name: "Amazon Bedrock",
    description: "Cloud models via AWS Bedrock",
    icon: "◉",
    authType: "aws",
    api: "openai-completions",
    fields: [
      { key: "region",          label: "AWS Region",         type: "text",     placeholder: "us-east-1",     required: true },
      { key: "accessKeyId",     label: "Access Key ID",      type: "text",     placeholder: "AKIA...",        required: true },
      { key: "secretAccessKey", label: "Secret Access Key",  type: "password", placeholder: "wJal...",        required: true },
    ],
    freeTextModel: true,
    presetModels: [
      { id: "anthropic.claude-opus-4-20250514-v2:0",     name: "Claude Opus 4 (Bedrock)",    contextWindow: 200000 },
      { id: "anthropic.claude-sonnet-4-20250514-v1:0",   name: "Claude Sonnet 4 (Bedrock)",  contextWindow: 200000 },
      { id: "anthropic.claude-haiku-3-5-20241022-v1:0",  name: "Claude Haiku 3.5 (Bedrock)", contextWindow: 200000 },
      { id: "amazon.nova-pro-v1:0",                      name: "Amazon Nova Pro",             contextWindow: 300000 },
    ],
    docsUrl: "https://aws.amazon.com/bedrock/",
  },
  {
    id: "custom",
    name: "Custom / OpenAI-compatible",
    description: "Any OpenAI-compatible API endpoint",
    icon: "⚙",
    authType: "api_key",
    api: "openai-completions",
    fields: [
      { key: "baseUrl", label: "Base URL",  type: "url",      placeholder: "https://api.example.com/v1", required: true },
      { key: "apiKey",  label: "API Key",   type: "password", placeholder: "sk-...", required: false,
        hint: "Leave empty if no authentication required" },
    ],
    freeTextModel: true,
    presetModels: [],
    docsUrl: undefined,
  },
  {
    id: "custom-oauth",
    name: "Custom / OpenAI OAuth",
    description: "OpenAI-compatible endpoint with OAuth authentication",
    icon: "🔐",
    authType: "oauth",
    api: "openai-codex-responses",
    fields: [
      { key: "baseUrl",   label: "API Base URL",            type: "url",  placeholder: "https://api.example.com/v1",         required: true,
        hint: "The endpoint for API calls (chat, completions, etc.)" },
      { key: "oauthUrl",  label: "OAuth Authorization URL", type: "url",  placeholder: "https://auth.example.com/authorize", required: true,
        hint: "The URL where users are sent to log in and authorize access" },
      { key: "clientId",  label: "Client ID",               type: "text", placeholder: "my-client-id",                       required: false,
        hint: "Optional — required for authorization code / PKCE flows" },
    ],
    freeTextModel: true,
    presetModels: [],
    docsUrl: undefined,
  },
];

export function getProviderDef(id: string): ProviderDef | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}

/** Format a model key as used in openclaw.json: "provider/modelId" */
export function modelKey(provider: string, modelId: string): string {
  return `${provider}/${modelId}`;
}

/** Parse a model key back to { provider, modelId } */
export function parseModelKey(key: string): { provider: string; modelId: string } {
  const idx = key.indexOf("/");
  if (idx === -1) return { provider: "unknown", modelId: key };
  return { provider: key.slice(0, idx), modelId: key.slice(idx + 1) };
}
