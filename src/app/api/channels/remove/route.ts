/**
 * DELETE /api/channels/remove
 * Removes a channel via `openclaw channels remove --delete`.
 */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { homedir } from "os";

export async function DELETE(req: Request) {
  const body = await req.json() as { channel: string };
  const { channel } = body;

  if (!channel) {
    return NextResponse.json({ ok: false, error: "channel is required" }, { status: 400 });
  }

  try {
    const out = execSync(`openclaw channels remove --channel ${channel} --delete`, {
      timeout: 10_000,
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
