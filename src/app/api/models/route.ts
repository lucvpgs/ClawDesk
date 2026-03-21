import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeAgents, runtimeSessions, runtimeSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GatewayClient } from "@/server/connector/gateway-client";

export async function GET() {
  const db = getDb();
  const sources = await db.select().from(runtimeSources).where(eq(runtimeSources.isDefault, true)).limit(1);
  if (!sources[0]) return NextResponse.json({ models: [], agents: [] });

  const [agents, sessions] = await Promise.all([
    db.select().from(runtimeAgents).where(eq(runtimeAgents.runtimeSourceId, sources[0].id)),
    db.select().from(runtimeSessions).where(eq(runtimeSessions.runtimeSourceId, sources[0].id)),
  ]);

  // Get status for fallback model info
  const client = new GatewayClient({ baseUrl: sources[0].gatewayUrl, token: sources[0].authToken ?? "" });
  const status = await client.getStatus() as Record<string, unknown> | null;
  const sessionDefaults = (status?.sessions as Record<string, unknown> | undefined)?.defaults as Record<string, unknown> | undefined;

  // Build model summary grouped by model name
  const modelMap = new Map<string, { model: string; agents: string[]; sessionCount: number }>();
  for (const agent of agents) {
    const m = agent.model ?? "unknown";
    if (!modelMap.has(m)) modelMap.set(m, { model: m, agents: [], sessionCount: 0 });
    modelMap.get(m)!.agents.push(agent.name ?? agent.agentId);
  }
  for (const session of sessions) {
    const agentModel = agents.find((a) => a.agentId === session.agentId)?.model ?? "unknown";
    const entry = modelMap.get(agentModel);
    if (entry) entry.sessionCount++;
  }

  return NextResponse.json({
    models: Array.from(modelMap.values()),
    agents: agents.map((a) => ({
      agentId: a.agentId,
      name: a.name,
      model: a.model,
      sessionCount: sessions.filter((s) => s.agentId === a.agentId).length,
    })),
    defaults: {
      model: sessionDefaults?.model ?? null,
      contextTokens: sessionDefaults?.contextTokens ?? null,
    },
    runtimeVersion: (status?.runtimeVersion as string) ?? null,
  });
}
