import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { activityEvents, runtimeSources } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const db = getDb();

  const sources = await db
    .select()
    .from(runtimeSources)
    .where(eq(runtimeSources.isDefault, true))
    .limit(1);

  const events = sources[0]
    ? await db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.runtimeSourceId, sources[0].id))
        .orderBy(desc(activityEvents.occurredAt))
        .limit(100)
    : await db
        .select()
        .from(activityEvents)
        .orderBy(desc(activityEvents.occurredAt))
        .limit(100);

  // rawJson is included so the detail panel can show full event payload
  return NextResponse.json({ events });
}
