import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { runtimeSources, runtimeSourceState } from "@/db/schema";
import { scanLocalOpenClaw } from "@/server/connector/openclaw-scan";
import { GatewayClient } from "@/server/connector/gateway-client";
import { syncRuntime } from "@/server/connector/sync";
import { generateId } from "@/lib/utils";

/**
 * GET /api/runtime-sources/auto-setup
 *
 * Called on first launch (when noRuntime=true).
 * Scans for a local OpenClaw installation and connects automatically
 * if the gateway is reachable — no user interaction required.
 *
 * Returns:
 *   { provisioned: true }  — successfully connected
 *   { provisioned: false, reason: "already_configured" }  — runtime already in DB
 *   { provisioned: false, reason: "not_found" | "unreachable" | "error", detail?: string }
 */
export async function GET() {
  const db = getDb();

  // Skip if a runtime source already exists
  const existing = await db.select().from(runtimeSources).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ provisioned: false, reason: "already_configured" });
  }

  // Scan for local OpenClaw
  const scan = scanLocalOpenClaw();
  if (!scan.found || !scan.gatewayUrl) {
    return NextResponse.json({ provisioned: false, reason: "not_found", detail: scan.error });
  }

  // Probe gateway
  const client = new GatewayClient({
    baseUrl: scan.gatewayUrl,
    token: scan.authToken ?? "",
    cliBinary: scan.cliBinary,
  });
  const probe = await client.probe();
  if (!probe.ok) {
    return NextResponse.json({
      provisioned: false,
      reason: "unreachable",
      detail: probe.error,
    });
  }

  // Create runtime source
  const sourceId = generateId();
  await db.insert(runtimeSources).values({
    id: sourceId,
    name: "Local OpenClaw",
    gatewayUrl: scan.gatewayUrl,
    connectionMode: "local",
    authMode: "token",
    authToken: scan.authToken ?? "",
    isDefault: true,
    isActive: true,
  });

  await db.insert(runtimeSourceState).values({
    id: generateId(),
    runtimeSourceId: sourceId,
    status: "disconnected",
  });

  // Initial sync
  await syncRuntime(sourceId, client).catch(() => {/* sync errors are non-fatal */});

  return NextResponse.json({ provisioned: true, runtimeSourceId: sourceId });
}
