/**
 * POST /api/channels/test
 * Forces a fresh health probe for a specific channel type.
 * Body: { channelType: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GatewayClient } from "@/server/connector/gateway-client";

export async function POST(req: NextRequest) {
  try {
    const { channelType } = await req.json() as { channelType: string };
    if (!channelType) return NextResponse.json({ error: "channelType required" }, { status: 400 });

    const db = getDb();
    const sources = await db.select().from(runtimeSources).where(eq(runtimeSources.isDefault, true)).limit(1);
    if (!sources[0]) return NextResponse.json({ error: "No gateway connected" }, { status: 503 });

    const client = new GatewayClient({ baseUrl: sources[0].gatewayUrl, token: sources[0].authToken ?? "" });
    const health = await client.getHealth();
    const healthChannels = (health as Record<string, unknown> | null)?.channels as Record<string, unknown> | undefined;

    if (!healthChannels) return NextResponse.json({ error: "Gateway unreachable" }, { status: 503 });

    const ch = healthChannels[channelType] as Record<string, unknown> | undefined;
    if (!ch) return NextResponse.json({ error: `Channel "${channelType}" not found in gateway` }, { status: 404 });

    const probe = ch.probe as Record<string, unknown> | undefined;

    return NextResponse.json({
      channelType,
      configured: ch.configured ?? false,
      running: ch.running ?? false,
      lastError: ch.lastError ?? null,
      probe: probe ?? null,
      testedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
