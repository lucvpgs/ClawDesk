import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeSources, runtimeSourceState } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const sources = await db.select().from(runtimeSources);

  const result = await Promise.all(
    sources.map(async (source) => {
      const state = await db
        .select()
        .from(runtimeSourceState)
        .where(eq(runtimeSourceState.runtimeSourceId, source.id))
        .limit(1);
      return {
        ...source,
        state: state[0] ?? null,
      };
    })
  );

  return NextResponse.json(result);
}
