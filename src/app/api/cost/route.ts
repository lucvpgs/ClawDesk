/**
 * GET /api/cost — aggregates token usage → cost from all sessions
 * Returns summary (today/week/month/projected), byAgent, byModel, byDay (30d)
 */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { cliEnv } from "@/server/cli-env";
import { findOpenClawBinary } from "@/server/connector/openclaw-scan";
import { getMergedRates, findRate, calcCost } from "@/server/cost-utils";

interface RawSession {
  sessionId: string;
  agentId: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  updatedAt: number; // unix ms
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function GET() {
  const bin = findOpenClawBinary() ?? "openclaw";

  let sessions: RawSession[] = [];
  try {
    const out = execSync(`${bin} sessions --all-agents --json`, {
      timeout: 10_000,
      encoding: "utf-8",
      env: cliEnv(),
    });
    const data = JSON.parse(out);
    sessions = (data?.sessions ?? []).map((s: RawSession) => ({
      sessionId:    s.sessionId,
      agentId:      s.agentId,
      model:        s.model ?? null,
      inputTokens:  s.inputTokens  ?? 0,
      outputTokens: s.outputTokens ?? 0,
      totalTokens:  s.totalTokens  ?? 0,
      updatedAt:    s.updatedAt    ?? 0,
    }));
  } catch {
    // Return zeros on error — page still renders
  }

  const rates = getMergedRates();
  const now   = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const ms7d  = 7  * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;

  // Aggregate
  const byAgent: Record<string, { inputTokens: number; outputTokens: number; cost: number }> = {};
  const byModel: Record<string, { inputTokens: number; outputTokens: number; cost: number; sessions: number }> = {};
  const byDay:   Record<string, { inputTokens: number; outputTokens: number; cost: number }> = {};

  let totalToday = 0, total7d = 0, total30d = 0, totalAll = 0;

  for (const s of sessions) {
    const rate = findRate(s.model, rates);
    const cost = calcCost(s.inputTokens, s.outputTokens, rate);
    const age  = now - s.updatedAt;

    totalAll += cost;
    if (s.updatedAt >= startOfToday.getTime()) totalToday += cost;
    if (age <= ms7d)  total7d  += cost;
    if (age <= ms30d) total30d += cost;

    // By agent
    if (!byAgent[s.agentId]) byAgent[s.agentId] = { inputTokens: 0, outputTokens: 0, cost: 0 };
    byAgent[s.agentId].inputTokens  += s.inputTokens;
    byAgent[s.agentId].outputTokens += s.outputTokens;
    byAgent[s.agentId].cost         += cost;

    // By model
    const modelKey = s.model ?? "unknown";
    if (!byModel[modelKey]) byModel[modelKey] = { inputTokens: 0, outputTokens: 0, cost: 0, sessions: 0 };
    byModel[modelKey].inputTokens  += s.inputTokens;
    byModel[modelKey].outputTokens += s.outputTokens;
    byModel[modelKey].cost         += cost;
    byModel[modelKey].sessions     += 1;

    // By day (last 30d only)
    if (age <= ms30d) {
      const day = isoDate(s.updatedAt);
      if (!byDay[day]) byDay[day] = { inputTokens: 0, outputTokens: 0, cost: 0 };
      byDay[day].inputTokens  += s.inputTokens;
      byDay[day].outputTokens += s.outputTokens;
      byDay[day].cost         += cost;
    }
  }

  // Project monthly spend based on last 7 days average
  const dailyAvg7d   = total7d / 7;
  const projectedMonth = dailyAvg7d * 30;

  // Sort by cost desc
  const agentList = Object.entries(byAgent)
    .map(([agentId, v]) => ({ agentId, ...v }))
    .sort((a, b) => b.cost - a.cost);

  const modelList = Object.entries(byModel)
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.cost - a.cost);

  // Fill in all days for the last 30d (including zeros)
  const dayList: Array<{ date: string; cost: number; inputTokens: number; outputTokens: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = isoDate(d.getTime());
    dayList.push({ date: key, ...(byDay[key] ?? { inputTokens: 0, outputTokens: 0, cost: 0 }) });
  }

  return NextResponse.json({
    summary: {
      today:          totalToday,
      week:           total7d,
      month:          total30d,
      projectedMonth: projectedMonth,
      allTime:        totalAll,
    },
    byAgent: agentList,
    byModel: modelList,
    byDay:   dayList,
  });
}
