/**
 * Scans the local device for an OpenClaw installation.
 * Reads ~/.openclaw/openclaw.json and extracts gateway connection details.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import type { OpenClawConfig, ScanResult } from "@/types";

const BINARY_PATHS = [
  "/opt/homebrew/bin/openclaw",
  "/usr/local/bin/openclaw",
  "/usr/bin/openclaw",
  path.join(os.homedir(), ".local/bin/openclaw"),
];

export function findOpenClawBinary(): string | null {
  for (const p of BINARY_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const extraPaths = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
    const PATH = process.env.PATH ? `${process.env.PATH}:${extraPaths}` : extraPaths;
    const found = execSync("which openclaw", {
      encoding: "utf-8",
      timeout: 2000,
      env: { ...process.env, PATH },
    }).trim();
    if (found) return found;
  } catch { /* not found in PATH */ }
  return null;
}

const CONFIG_PATHS = [
  path.join(os.homedir(), ".openclaw", "openclaw.json"),
  path.join(os.homedir(), ".config", "openclaw", "openclaw.json"),
];

export function scanLocalOpenClaw(): ScanResult {
  for (const configPath of CONFIG_PATHS) {
    if (!fs.existsSync(configPath)) continue;

    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config: OpenClawConfig = JSON.parse(raw);

      const port = config.gateway?.port ?? 18789;
      const bind = config.gateway?.bind ?? "loopback";
      const host = bind === "loopback" ? "localhost" : "localhost";
      const gatewayUrl = `http://${host}:${port}`;

      const authToken = config.gateway?.auth?.token;

      const agents = config.agents?.list ?? [];
      const defaultAgent = agents.find((a) => a.default) ?? agents[0];

      const cliBinary = findOpenClawBinary();

      return {
        found: true,
        configPath,
        gatewayUrl,
        authToken,
        primaryAgent: defaultAgent?.name ?? defaultAgent?.id,
        agentCount: agents.length,
        version: config.meta?.lastTouchedVersion,
        cliBinary: cliBinary ?? undefined,
      };
    } catch (e) {
      return {
        found: false,
        error: `Found config at ${configPath} but failed to parse: ${String(e)}`,
      };
    }
  }

  return { found: false, error: "No OpenClaw installation found on this device." };
}
