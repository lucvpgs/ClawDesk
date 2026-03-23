/**
 * GET /api/cost/export?format=csv
 * Returns raw per-session cost data as a CSV file download.
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
  return new Date(ts).toISOString().slice(0, 10);
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
    // Return empty CSV on error
  }

  const rates = getMergedRates();

  const header = "date,agentId,model,inputTokens,outputTokens,totalTokens,cost";
  const rows = sessions.map((s) => {
    const rate = findRate(s.model, rates);
    const cost = calcCost(s.inputTokens, s.outputTokens, rate);
    return [
      isoDate(s.updatedAt),
      s.agentId,
      s.model ?? "unknown",
      s.inputTokens,
      s.outputTokens,
      s.totalTokens,
      cost.toFixed(6),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="clawdesk-cost-export.csv"',
    },
  });
}
