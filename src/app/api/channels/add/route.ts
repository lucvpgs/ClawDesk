/**
 * POST /api/channels/add
 * Adds or updates a channel via `openclaw channels add`.
 * Supports: discord, telegram, slack, googlechat
 */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { homedir } from "os";

const SUPPORTED = ["discord", "telegram", "slack", "googlechat"] as const;
type SupportedChannel = (typeof SUPPORTED)[number];

export async function POST(req: Request) {
  const body = await req.json() as {
    channel: SupportedChannel;
    name?: string;
    // discord / telegram
    token?: string;
    // slack
    botToken?: string;
    appToken?: string;
    // googlechat
    webhookUrl?: string;
  };

  const { channel, name, token, botToken, appToken, webhookUrl } = body;

  if (!channel || !SUPPORTED.includes(channel)) {
    return NextResponse.json({ ok: false, error: `Unsupported channel: ${channel}` }, { status: 400 });
  }

  // Build CLI args
  const args: string[] = ["openclaw", "channels", "add", "--channel", channel];

  if (token)      args.push("--token",       token.trim());
  if (botToken)   args.push("--bot-token",   botToken.trim());
  if (appToken)   args.push("--app-token",   appToken.trim());
  if (webhookUrl) args.push("--webhook-url", webhookUrl.trim());
  if (name)       args.push("--name",        name.trim());

  // Validate required fields per channel
  if ((channel === "discord" || channel === "telegram") && !token) {
    return NextResponse.json({ ok: false, error: "Bot token is required" }, { status: 400 });
  }
  if (channel === "slack" && (!botToken || !appToken)) {
    return NextResponse.json({ ok: false, error: "Both bot token (xoxb-) and app token (xapp-) are required" }, { status: 400 });
  }
  if (channel === "googlechat" && !webhookUrl) {
    return NextResponse.json({ ok: false, error: "Webhook URL is required" }, { status: 400 });
  }

  try {
    const out = execSync(args.join(" "), {
      timeout: 15_000,
      encoding: "utf-8",
      env: { ...process.env, HOME: homedir() },
    });
    return NextResponse.json({ ok: true, output: out.trim() });
  } catch (e: unknown) {
    const msg = (e as { stderr?: string; message?: string }).stderr
      ?? (e as { message?: string }).message
      ?? String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
