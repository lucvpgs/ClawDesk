import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeAgents, runtimeSessions, runtimeSources } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();

  const sources = await db
    .select()
    .from(runtimeSources)
    .where(eq(runtimeSources.isDefault, true))
    .limit(1);

  if (!sources[0]) return NextResponse.json({ agents: [] });

  const sourceId = sources[0].id;

  const [agents, sessions] = await Promise.all([
    db.select().from(runtimeAgents).where(eq(runtimeAgents.runtimeSourceId, sourceId)),
    db.select().from(runtimeSessions).where(eq(runtimeSessions.runtimeSourceId, sourceId)),
  ]);

  const enriched = agents.map((a) => {
    const agentSessions = sessions.filter((s) => s.agentId === a.agentId);
    return {
      ...a,
      sessionCount: agentSessions.length,
      sessions: agentSessions.map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        channel: s.channel,
      })),
    };
  });

  return NextResponse.json({ agents: enriched });
}
