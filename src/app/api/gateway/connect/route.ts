import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeSources, runtimeSourceState } from "@/db/schema";
import { GatewayClient } from "@/server/connector/gateway-client";
import { syncRuntime } from "@/server/connector/sync";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, gatewayUrl, authToken, connectionMode = "local", cliBinary } = body;

  if (!name || !gatewayUrl) {
    return NextResponse.json(
      { error: "name and gatewayUrl are required" },
      { status: 400 }
    );
  }

  // 1. Probe the gateway
  const client = new GatewayClient({ baseUrl: gatewayUrl, token: authToken ?? "", cliBinary });
  const probe = await client.probe();

  if (!probe.ok) {
    return NextResponse.json(
      { error: `Gateway unreachable: ${probe.error}` },
      { status: 422 }
    );
  }

  const db = getDb();

  // 2. Check if this gateway is already registered
  const existing = await db
    .select()
    .from(runtimeSources)
    .where(eq(runtimeSources.gatewayUrl, gatewayUrl))
    .limit(1);

  let sourceId: string;

  if (existing.length > 0) {
    sourceId = existing[0].id;
    // Update token if changed
    await db
      .update(runtimeSources)
      .set({ authToken, name, updatedAt: new Date().toISOString() })
      .where(eq(runtimeSources.id, sourceId));
  } else {
    // 3. Count existing sources to set default flag
    const allSources = await db.select().from(runtimeSources);
    const isDefault = allSources.length === 0;

    sourceId = generateId();
    await db.insert(runtimeSources).values({
      id: sourceId,
      name,
      gatewayUrl,
      connectionMode,
      authMode: "token",
      authToken,
      isDefault,
      isActive: true,
    });

    await db.insert(runtimeSourceState).values({
      id: generateId(),
      runtimeSourceId: sourceId,
      status: "disconnected",
    });
  }

  // 4. Initial sync
  const syncResult = await syncRuntime(sourceId, client);

  return NextResponse.json({
    ok: true,
    runtimeSourceId: sourceId,
    probe,
    sync: syncResult,
  });
}
