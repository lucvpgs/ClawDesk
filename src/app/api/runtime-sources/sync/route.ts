import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GatewayClient } from "@/server/connector/gateway-client";
import { syncRuntime } from "@/server/connector/sync";

export async function POST() {
  const db = getDb();

  const sources = await db
    .select()
    .from(runtimeSources)
    .where(eq(runtimeSources.isDefault, true))
    .limit(1);

  if (!sources[0]) {
    return NextResponse.json({ error: "No runtime source configured" }, { status: 404 });
  }

  const source = sources[0];
  const client = new GatewayClient({
    baseUrl: source.gatewayUrl,
    token: source.authToken ?? "",
  });

  const result = await syncRuntime(source.id, client);
  return NextResponse.json(result);
}
