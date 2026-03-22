/**
 * POST /api/agents/run
 * Sends a prompt directly to an agent via the OpenClaw gateway CLI.
 * Body: { agentId: string; message: string; thinking?: string; timeoutSecs?: number }
 *
 * Uses execFile (not execSync/exec with shell) to avoid shell injection.
 */
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { findOpenClawBinary } from "@/server/connector/openclaw-scan";
import { cliEnv } from "@/server/cli-env";

const execFileAsync = promisify(execFile);

const VALID_THINKING = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      agentId: string;
      message: string;
      thinking?: string;
      timeoutSecs?: number;
    };

    const { agentId, message, thinking, timeoutSecs = 120 } = body;

    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const bin = findOpenClawBinary() ?? "openclaw";
    const args = ["agent", "--agent", agentId, "--message", message.trim(), "--json"];

    if (thinking && VALID_THINKING.has(thinking) && thinking !== "off") {
      args.push("--thinking", thinking);
    }

    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: timeoutSecs * 1_000,
      encoding: "utf-8",
      env: cliEnv(),
    });

    // openclaw agent --json outputs a JSON object
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      // Some versions emit non-JSON prefix lines — grab the last JSON block
      const jsonStart = stdout.lastIndexOf("{");
      if (jsonStart !== -1) {
        parsed = JSON.parse(stdout.slice(jsonStart));
      } else {
        return NextResponse.json({ error: "No JSON in agent output", raw: stdout, stderr }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true, result: parsed });
  } catch (err: unknown) {
    const e = err as { killed?: boolean; signal?: string; message?: string; stderr?: string; stdout?: string };

    if (e?.killed || e?.signal === "SIGTERM") {
      return NextResponse.json({ error: "Agent run timed out" }, { status: 504 });
    }

    return NextResponse.json(
      { error: e?.message ?? String(err), stderr: e?.stderr ?? null },
      { status: 500 },
    );
  }
}
