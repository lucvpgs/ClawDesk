/**
 * OpenClaw Gateway client.
 *
 * Connection mode:
 * - "local": Uses the `openclaw` CLI on the same machine (no auth headaches).
 *   This is the default and recommended mode for a local installation.
 * - "remote": WebSocket + Ed25519 device-identity auth (future).
 *
 * The CLI mode (exec openclaw gateway call <method> --json) is simpler, reliable,
 * and works perfectly for local-first use without any pairing ceremony.
 */

import { execSync } from "child_process";
import { findOpenClawBinary } from "./openclaw-scan";

export interface GatewayClientOptions {
  baseUrl: string;
  token: string;
  cliBinary?: string;   // path to openclaw binary (auto-detected if omitted)
}

export class GatewayClient {
  private baseUrl: string;
  private token: string;
  private bin: string;

  constructor(opts: GatewayClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.bin = opts.cliBinary ?? findOpenClawBinary() ?? "openclaw";
  }

  // ── CLI helper ───────────────────────────────────────────────────────────

  /** Builds an env suitable for execSync: inherits process.env and augments
   *  PATH with common binary directories so that node-based CLIs (openclaw,
   *  which is a .mjs shim) can locate the node executable even when the
   *  parent process was started with a minimal environment (e.g. Tauri). */
  private cliEnv(): NodeJS.ProcessEnv {
    const extraPaths = [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ].join(":");
    const currentPath = process.env.PATH ?? "";
    const merged = currentPath ? `${currentPath}:${extraPaths}` : extraPaths;
    return { ...process.env, PATH: merged, HOME: process.env.HOME ?? "/tmp" };
  }

  private cliCall<T = unknown>(method: string, extraArgs: string[] = []): T | null {
    try {
      const args = ["gateway", "call", method, "--json", ...extraArgs].join(" ");
      const out = execSync(`${this.bin} ${args}`, {
        timeout: 10_000,
        encoding: "utf-8",
        env: this.cliEnv(),
      });
      return JSON.parse(out) as T;
    } catch {
      return null;
    }
  }

  private cliRun<T = unknown>(subcommand: string): T | null {
    try {
      const out = execSync(`${this.bin} ${subcommand} --json`, {
        timeout: 10_000,
        encoding: "utf-8",
        env: this.cliEnv(),
      });
      return JSON.parse(out) as T;
    } catch {
      return null;
    }
  }

  // ── Probe ────────────────────────────────────────────────────────────────

  async probe(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const status = this.cliCall<{ runtimeVersion?: string }>("status");
      if (status?.runtimeVersion) {
        return { ok: true, version: status.runtimeVersion };
      }
      // Fallback: HTTP GET on gateway root
      const res = await fetch(this.baseUrl, { signal: AbortSignal.timeout(3000) });
      return { ok: res.ok || res.status === 200 };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // ── Status / Health ───────────────────────────────────────────────────────

  async getStatus() {
    return this.cliCall<Record<string, unknown>>("status");
  }

  async getHealth() {
    return this.cliCall<Record<string, unknown>>("health");
  }

  // ── Agents ───────────────────────────────────────────────────────────────

  async getAgents(): Promise<unknown[]> {
    const data = this.cliRun<unknown[]>("agents list");
    if (Array.isArray(data)) return data;
    return [];
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(): Promise<unknown[]> {
    const status = this.cliCall<{
      sessions?: { recent?: unknown[] };
    }>("status");
    return status?.sessions?.recent ?? [];
  }

  // ── Cron ─────────────────────────────────────────────────────────────────

  async getCronJobs(): Promise<unknown[]> {
    const data = this.cliRun<{ jobs?: unknown[] }>("cron list");
    return data?.jobs ?? [];
  }

  // ── Channels ─────────────────────────────────────────────────────────────

  async getChannels(): Promise<{ type: string; status: string; raw: unknown }[]> {
    const health = this.cliCall<{ channels?: Record<string, unknown> }>("health");
    if (!health?.channels) return [];
    return Object.entries(health.channels).map(([type, raw]) => {
      const ch = raw as Record<string, unknown>;
      const running = ch.running === true;
      const ok = (ch.probe as Record<string, unknown> | undefined)?.ok === true;
      return {
        type,
        status: running ? "active" : ok ? "configured" : "error",
        raw,
      };
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async runCronNow(jobId: string): Promise<unknown> {
    return this.cliRun(`cron run ${jobId}`);
  }
}
