"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";

interface AgentConfig {
  id: string;
  budgetPerDay?: number;
}

interface CostData {
  byAgent: Array<{ agentId: string; cost: number }>;
}

// Key format: clawdesk:budgetAlert:agentId:YYYY-MM-DD:threshold(80|100)
function alertKey(agentId: string, threshold: 80 | 100): string {
  const date = new Date().toISOString().slice(0, 10);
  return `clawdesk:budgetAlert:${agentId}:${date}:${threshold}`;
}

function alreadySent(key: string): boolean {
  try { return !!localStorage.getItem(key); } catch { return false; }
}

function markSent(key: string) {
  try { localStorage.setItem(key, "1"); } catch { /* noop */ }
}

async function checkBudgets() {
  try {
    const [costRes, configRes] = await Promise.all([
      fetch("/api/cost"),
      fetch("/api/agents/config"),
    ]);
    if (!costRes.ok || !configRes.ok) return;

    const costData: CostData = await costRes.json();
    const configData: { agents: AgentConfig[] } = await configRes.json();

    for (const agent of configData.agents) {
      if (!agent.budgetPerDay || agent.budgetPerDay <= 0) continue;

      const agentCost = costData.byAgent.find((a) => a.agentId === agent.id);
      const todaySpend = agentCost?.cost ?? 0;
      const pct = (todaySpend / agent.budgetPerDay) * 100;

      const key80  = alertKey(agent.id, 80);
      const key100 = alertKey(agent.id, 100);

      if (pct >= 100 && !alreadySent(key100)) {
        toast(`⚠️ ${agent.id}: daily budget EXCEEDED ($${todaySpend.toFixed(2)} / $${agent.budgetPerDay})`, "error");
        markSent(key100);
      } else if (pct >= 80 && !alreadySent(key80)) {
        toast(`💸 ${agent.id}: at ${Math.round(pct)}% of daily budget ($${todaySpend.toFixed(2)} / $${agent.budgetPerDay})`, "warning");
        markSent(key80);
      }
    }
  } catch { /* silent — non-critical */ }
}

export function useBudgetWatcher() {
  useEffect(() => {
    // Initial check after 10s (let the app settle)
    const initial = setTimeout(checkBudgets, 10_000);
    // Then every 15 minutes
    const interval = setInterval(checkBudgets, 15 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);
}
