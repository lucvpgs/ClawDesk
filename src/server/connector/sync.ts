/**
 * Syncs runtime data from OpenClaw (via CLI) into the local SQLite snapshot tables.
 */

import { getDb } from "@/db";
import {
  runtimeAgents,
  runtimeSessions,
  runtimeCronJobs,
  runtimeChannels,
  runtimeSourceState,
  activityEvents,
} from "@/db/schema";
import { GatewayClient } from "./gateway-client";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function syncRuntime(runtimeSourceId: string, client: GatewayClient) {
  const db = getDb();
  const now = new Date().toISOString();
  const errors: string[] = [];

  // ── Agents ────────────────────────────────────────────────────────────
  try {
    const agents = await client.getAgents();
    await db.delete(runtimeAgents).where(eq(runtimeAgents.runtimeSourceId, runtimeSourceId));
    for (const agent of agents as Array<Record<string, unknown>>) {
      await db.insert(runtimeAgents).values({
        id: generateId(),
        runtimeSourceId,
        agentId: String(agent.id ?? "unknown"),
        name: agent.name ? String(agent.name) : null,
        model: agent.model ? String(agent.model) : null,
        status: agent.isDefault ? "default" : "active",
        workspace: agent.workspace ? String(agent.workspace) : null,
        rawJson: JSON.stringify(agent),
        observedAt: now,
      });
    }
  } catch (e) {
    errors.push(`agents: ${String(e)}`);
  }

  // ── Sessions ──────────────────────────────────────────────────────────
  try {
    const sessions = await client.getSessions();
    await db.delete(runtimeSessions).where(eq(runtimeSessions.runtimeSourceId, runtimeSourceId));
    const seenSessionIds = new Set<string>();
    for (const session of sessions as Array<Record<string, unknown>>) {
      const sessionId = String(session.sessionId ?? session.key ?? generateId());
      if (seenSessionIds.has(sessionId)) continue;
      seenSessionIds.add(sessionId);
      await db.insert(runtimeSessions).values({
        id: generateId(),
        runtimeSourceId,
        sessionId,
        agentId: session.agentId ? String(session.agentId) : null,
        status: session.abortedLastRun ? "error" : "active",
        channel: session.key ? String(session.key).split(":")[2] ?? null : null,
        rawJson: JSON.stringify(session),
        observedAt: now,
      });
    }
  } catch (e) {
    errors.push(`sessions: ${String(e)}`);
  }

  // ── Cron jobs ─────────────────────────────────────────────────────────
  try {
    const jobs = await client.getCronJobs();
    await db.delete(runtimeCronJobs).where(eq(runtimeCronJobs.runtimeSourceId, runtimeSourceId));
    for (const job of jobs as Array<Record<string, unknown>>) {
      await db.insert(runtimeCronJobs).values({
        id: generateId(),
        runtimeSourceId,
        jobId: String(job.id ?? job.jobId ?? generateId()),
        name: job.name ? String(job.name) : null,
        schedule: job.schedule ? String(job.schedule) : null,
        status: job.enabled ? "active" : "paused",
        lastRunAt: job.lastRunAt ? String(job.lastRunAt) : null,
        nextRunAt: job.nextRunAt ? String(job.nextRunAt) : null,
        rawJson: JSON.stringify(job),
        observedAt: now,
      });
    }
  } catch (e) {
    errors.push(`cron: ${String(e)}`);
  }

  // ── Channels ──────────────────────────────────────────────────────────
  try {
    const channels = await client.getChannels();
    await db.delete(runtimeChannels).where(eq(runtimeChannels.runtimeSourceId, runtimeSourceId));
    for (const ch of channels) {
      await db.insert(runtimeChannels).values({
        id: generateId(),
        runtimeSourceId,
        channelType: ch.type,
        status: ch.status,
        rawJson: JSON.stringify(ch.raw),
        observedAt: now,
      });
    }
  } catch (e) {
    errors.push(`channels: ${String(e)}`);
  }

  // ── Update source state ────────────────────────────────────────────────
  const connected = errors.length === 0;
  await db
    .update(runtimeSourceState)
    .set({
      status: connected ? "connected" : "degraded",
      lastSeenAt: now,
      lastSyncAt: now,
      degradedReason: errors.length > 0 ? errors.join("; ") : null,
      updatedAt: now,
    })
    .where(eq(runtimeSourceState.runtimeSourceId, runtimeSourceId));

  // ── Activity event ────────────────────────────────────────────────────
  await db.insert(activityEvents).values({
    id: generateId(),
    runtimeSourceId,
    eventType: "sync",
    entityType: "runtime",
    entityId: runtimeSourceId,
    summary: connected
      ? "Runtime synced successfully"
      : `Sync with errors: ${errors.join("; ")}`,
    occurredAt: now,
  });

  return { ok: connected, errors, syncedAt: now };
}
