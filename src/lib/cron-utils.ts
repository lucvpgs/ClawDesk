/**
 * Shared cron job normalization utilities.
 * OpenClaw native format stores schedule as { kind, expr, tz } object.
 * ClawDesk format uses a plain string. This handles both.
 *
 * Delivery destination: OpenClaw uses delivery.to (set via `--to` CLI flag).
 * ClawDesk surfaces this as `deliveryTo` and writes it back as delivery.to.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSchedule(raw: any): string {
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "expr" in raw) {
    return String((raw as { expr: unknown }).expr ?? "");
  }
  return "";
}

export interface NormalizedCronJob {
  id: string;
  name: string;
  agentId: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  /** Channel type (discord / slack / telegram) */
  outputTarget: string | null;
  /** Delivery destination: Discord channel ID, Telegram chat ID, E.164, etc. */
  deliveryTo: string | null;
  tags: string[];
  nextRunAt?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCronJob(raw: any): NormalizedCronJob {
  const schedule = normalizeSchedule(raw.schedule);

  const prompt: string =
    raw.prompt ??
    raw.payload?.message ??
    raw.payload?.text ??
    "";

  const agentId: string = raw.agentId ?? raw.payload?.agentId ?? "main";

  // Channel type (e.g. "discord", "telegram")
  const outputTarget: string | null =
    raw.outputTarget ?? raw.delivery?.channel ?? null;

  // Delivery destination — what OpenClaw uses to know WHERE to send the output.
  // Stored as delivery.to by the OpenClaw CLI (--to flag).
  const deliveryTo: string | null =
    raw.deliveryTo ?? raw.delivery?.to ?? null;

  const createdAt: string =
    raw.createdAt ??
    (raw.createdAtMs ? new Date(raw.createdAtMs).toISOString() : new Date().toISOString());

  const updatedAt: string | undefined =
    raw.updatedAt ??
    (raw.updatedAtMs ? new Date(raw.updatedAtMs).toISOString() : undefined);

  const nextRunAt: string | null = raw.state?.nextRunAtMs
    ? new Date(raw.state.nextRunAtMs).toISOString()
    : null;

  return {
    id:           raw.id,
    name:         raw.name ?? raw.id,
    agentId,
    schedule,
    prompt,
    enabled:      raw.enabled !== false,
    createdAt,
    updatedAt,
    outputTarget,
    deliveryTo,
    tags:         raw.tags ?? [],
    ...(nextRunAt !== null ? { nextRunAt } : {}),
  };
}
