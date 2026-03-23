import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { activityEvents, runtimeSources } from "@/db/schema";
import { eq, desc, or, isNull } from "drizzle-orm";

export async function GET() {
  const db = getDb();

  const sources = await db
    .select()
    .from(runtimeSources)
    .where(eq(runtimeSources.isDefault, true))
    .limit(1);

  // Show events from the default runtime source OR local events (no runtimeSourceId)
  // Task/project events are written locally without a runtimeSourceId — they must not be excluded.
  const events = sources[0]
    ? await db
        .select()
        .from(activityEvents)
        .where(or(
          eq(activityEvents.runtimeSourceId, sources[0].id),
          isNull(activityEvents.runtimeSourceId),
        ))
        .orderBy(desc(activityEvents.occurredAt))
        .limit(100)
    : await db
        .select()
        .from(activityEvents)
        .orderBy(desc(activityEvents.occurredAt))
        .limit(100);

  return NextResponse.json({ events });
}
