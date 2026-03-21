import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeSources, runtimeSourceState, runtimeChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GatewayClient } from "@/server/connector/gateway-client";
import { scanLocalOpenClaw } from "@/server/connector/openclaw-scan";

export async function GET() {
  const db = getDb();
  const sources = await db.select().from(runtimeSources).where(eq(runtimeSources.isDefault, true)).limit(1);
  if (!sources[0]) return NextResponse.json({ noRuntime: true });

  const [state, channels] = await Promise.all([
    db.select().from(runtimeSourceState).where(eq(runtimeSourceState.runtimeSourceId, sources[0].id)).limit(1),
    db.select().from(runtimeChannels).where(eq(runtimeChannels.runtimeSourceId, sources[0].id)),
  ]);

  const client = new GatewayClient({
    baseUrl: sources[0].gatewayUrl,
    token: sources[0].authToken ?? "",
  });

  const [status, health] = await Promise.all([
    client.getStatus() as Promise<Record<string, unknown> | null>,
    client.getHealth() as Promise<Record<string, unknown> | null>,
  ]);

  const scan = await scanLocalOpenClaw();

  const sessionDefaults = (status?.sessions as Record<string, unknown> | undefined)?.defaults as Record<string, unknown> | undefined;
  const healthChannels = (health as Record<string, unknown> | null)?.channels as Record<string, unknown> | undefined;

  return NextResponse.json({
    source: {
      id: sources[0].id,
      name: sources[0].name,
      gatewayUrl: sources[0].gatewayUrl,
      cliBinary: null,
      status: state[0]?.status ?? "unknown",
      lastSeenAt: state[0]?.lastSeenAt ?? null,
      lastSyncAt: state[0]?.lastSyncAt ?? null,
      degradedReason: state[0]?.degradedReason ?? null,
    },
    runtime: {
      version: (status?.runtimeVersion as string) ?? null,
      uptime: (status?.uptime as string | number) ?? null,
      sessionDefaultModel: sessionDefaults?.model ?? null,
      sessionDefaultContextTokens: sessionDefaults?.contextTokens ?? null,
    },
    channels: channels.map((ch) => {
      const live = healthChannels?.[ch.channelType] as Record<string, unknown> | undefined;
      const probe = live?.probe as Record<string, unknown> | undefined;
      return {
        channelType: ch.channelType,
        status: ch.status,
        running: live?.running ?? null,
        configured: live?.configured ?? null,
        lastError: live?.lastError ?? null,
        probe: probe ? { ok: probe.ok, elapsedMs: probe.elapsedMs } : null,
        observedAt: ch.observedAt,
      };
    }),
    scan: scan
      ? {
          version: scan.version ?? null,
          cliBinary: scan.cliBinary ?? null,
          agentCount: scan.agentCount ?? null,
        }
      : null,
  });
}
