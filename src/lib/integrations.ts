/**
 * Shared catalog + helpers for integrations.
 * Used by both the API routes and potentially the frontend.
 */

export function maskValue(val: string | null | undefined): string {
  if (!val) return "";
  if (val.length <= 8) return "••••••••";
  return "••••••••" + val.slice(-4);
}

export function isMasked(val: string): boolean {
  return val.startsWith("••••");
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface CatalogField {
  key: string; label: string;
  type: "token" | "api_key" | "webhook_url" | "text" | "boolean" | "select";
  sensitive?: boolean; required?: boolean;
  placeholder?: string; hint?: string; options?: string[];
}

export interface CatalogDef {
  id: string; name: string; description: string;
  category: "messaging" | "search" | "developer" | "productivity" | "custom";
  icon: string; docsUrl?: string;
  configPath: string[]; pluginPath?: string[];
  connectedKey?: string;
  fields: CatalogField[];
}

export interface CustomIntegration {
  id: string; name: string; category: string;
  authType: "api_key" | "token" | "webhook" | "basic" | "oauth" | "multi";
  credentials: Record<string, string>;
  enabled: boolean; createdAt: string; updatedAt?: string; notes?: string;
}

// ── Catalog ────────────────────────────────────────────────────────────────────
export const CATALOG: CatalogDef[] = [
  {
    id: "discord", name: "Discord",
    description: "Bot commands, notifications, agent control via Discord channels",
    category: "messaging", icon: "MessageSquare",
    docsUrl: "https://discord.com/developers/applications",
    configPath: ["channels", "discord"], pluginPath: ["plugins", "entries", "discord"],
    connectedKey: "token",
    fields: [
      { key: "enabled",   label: "Enabled",       type: "boolean" },
      { key: "token",     label: "Bot Token",      type: "token",   sensitive: true, required: true, placeholder: "MTQ3...", hint: "Discord Developer Portal → Bot → Token" },
      { key: "streaming", label: "Streaming mode", type: "select",  options: ["off", "on"] },
    ],
  },
  {
    id: "brave-search", name: "Brave Search",
    description: "Web search capability for agents",
    category: "search", icon: "Search",
    docsUrl: "https://brave.com/search/api/",
    configPath: ["tools", "web", "search"], connectedKey: "apiKey",
    fields: [
      { key: "enabled", label: "Enabled",  type: "boolean" },
      { key: "apiKey",  label: "API Key",  type: "api_key", sensitive: true, required: true, placeholder: "BSA6Yk...", hint: "brave.com/search/api → Keys" },
    ],
  },
  {
    id: "slack", name: "Slack",
    description: "Agent notifications and commands via Slack",
    category: "messaging", icon: "Hash",
    docsUrl: "https://api.slack.com/apps",
    configPath: ["channels", "slack"], connectedKey: "token",
    fields: [
      { key: "enabled",       label: "Enabled",        type: "boolean" },
      { key: "token",         label: "Bot Token",       type: "token",   sensitive: true, required: true, placeholder: "xoxb-..." },
      { key: "signingSecret", label: "Signing Secret",  type: "api_key", sensitive: true, placeholder: "abc123..." },
    ],
  },
  {
    id: "telegram", name: "Telegram",
    description: "Agent control via Telegram bot",
    category: "messaging", icon: "Send",
    docsUrl: "https://core.telegram.org/bots#botfather",
    configPath: ["channels", "telegram"], connectedKey: "token",
    fields: [
      { key: "enabled", label: "Enabled",    type: "boolean" },
      { key: "token",   label: "Bot Token",  type: "token",  sensitive: true, required: true, placeholder: "1234567890:ABC..." },
    ],
  },
  {
    id: "github", name: "GitHub",
    description: "Code operations, repo access, PR management",
    category: "developer", icon: "GitBranch",
    docsUrl: "https://github.com/settings/tokens",
    configPath: ["tools", "github"], connectedKey: "token",
    fields: [
      { key: "enabled",  label: "Enabled",               type: "boolean" },
      { key: "token",    label: "Personal Access Token",  type: "token",  sensitive: true, required: true, placeholder: "ghp_..." },
      { key: "username", label: "GitHub username",        type: "text",   placeholder: "your-username" },
    ],
  },
  {
    id: "notion", name: "Notion",
    description: "Read and write Notion pages and databases",
    category: "productivity", icon: "FileText",
    docsUrl: "https://www.notion.so/my-integrations",
    configPath: ["tools", "notion"], connectedKey: "token",
    fields: [
      { key: "enabled", label: "Enabled",           type: "boolean" },
      { key: "token",   label: "Integration Token", type: "token",  sensitive: true, required: true, placeholder: "secret_..." },
    ],
  },
  {
    id: "linear", name: "Linear",
    description: "Project tracking and issue management",
    category: "productivity", icon: "Layers",
    docsUrl: "https://linear.app/settings/api",
    configPath: ["tools", "linear"], connectedKey: "apiKey",
    fields: [
      { key: "enabled", label: "Enabled",  type: "boolean" },
      { key: "apiKey",  label: "API Key",  type: "api_key", sensitive: true, required: true, placeholder: "lin_api_..." },
    ],
  },
];

// Auth type → standard fields
export const AUTH_TYPE_FIELDS: Record<string, CatalogField[]> = {
  api_key: [{ key: "apiKey",  label: "API Key",       type: "api_key",     sensitive: true, required: true }],
  token:   [{ key: "token",   label: "Bearer Token",  type: "token",       sensitive: true, required: true }],
  webhook: [{ key: "url",     label: "Webhook URL",   type: "webhook_url", required: true },
            { key: "secret",  label: "Secret",        type: "token",       sensitive: true }],
  basic:   [{ key: "username",label: "Username",      type: "text",        required: true },
            { key: "password",label: "Password",      type: "token",       sensitive: true, required: true }],
  oauth:   [{ key: "clientId",     label: "Client ID",     type: "text",    required: true },
            { key: "clientSecret", label: "Client Secret", type: "api_key", sensitive: true, required: true },
            { key: "accessToken",  label: "Access Token",  type: "token",   sensitive: true }],
  multi:   [],
};
