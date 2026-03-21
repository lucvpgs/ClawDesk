import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { runtimeSources } from "@/db/schema";

export default async function RootPage() {
  const db = getDb();
  const sources = await db.select().from(runtimeSources).limit(1);

  if (sources.length === 0) {
    redirect("/onboarding");
  }

  redirect("/overview");
}
