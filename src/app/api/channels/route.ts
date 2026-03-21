import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeChannels, runtimeSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GatewayClient } from "@/server/connector/gateway-client";

export async function GET() {
  const db = getDb();
  const sources = await db.select().from(runtimeSources).where(eq(runtimeSources.isDefault, true)).limit(1);
  if (!sources[0]) return NextResponse.json({ channels: [] });

  // Return cached snapshot + live health data
  const cached = await db
    .select()
    .from(runtimeChannels)
    .where(eq(runtimeChannels.runtimeSourceId, sources[0].id));

  // Try to get fresh health data from CLI
  const client = new GatewayClient({ baseUrl: sources[0].gatewayUrl, token: sources[0].authToken ?? "" });
  const health = await client.getHealth();
  const healthChannels = (health as Record<string, unknown> | null)?.channels as Record<string, unknown> | undefined;

  const seenTypes = new Set<string>();

  const channels = cached.map((ch) => {
    seenTypes.add(ch.channelType);
    const live = healthChannels?.[ch.channelType] as Record<string, unknown> | undefined;
    const probe = live?.probe as Record<string, unknown> | undefined;
    return {
      id: ch.id,
      channelType: ch.channelType,
      status: ch.status,
      observedAt: ch.observedAt,
      configured: live?.configured ?? null,
      running: live?.running ?? null,
      lastError: live?.lastError ?? null,
      probe: probe ? {
        ok: probe.ok,
        bot: probe.bot,
        application: probe.application,
        elapsedMs: probe.elapsedMs,
      } : null,
    };
  });

  // Also include live channels not yet in the DB snapshot (e.g. first launch
  // before sync has run, or newly configured channels)
  if (healthChannels) {
    for (const [type, raw] of Object.entries(healthChannels)) {
      if (seenTypes.has(type)) continue;
      const live = raw as Record<string, unknown>;
      const probe = live.probe as Record<string, unknown> | undefined;
      channels.push({
        id: `live-${type}`,
        channelType: type,
        status: live.running ? "active" : live.configured ? "configured" : "inactive",
        observedAt: new Date().toISOString(),
        configured: (live.configured as boolean) ?? null,
        running: (live.running as boolean) ?? null,
        lastError: (live.lastError as string) ?? null,
        probe: probe ? {
          ok: probe.ok as boolean,
          bot: probe.bot,
          application: probe.application,
          elapsedMs: probe.elapsedMs as number,
        } : null,
      });
    }
  }

  return NextResponse.json({ channels });
}
