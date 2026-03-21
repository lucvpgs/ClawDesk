import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const expected = process.env.CLAWDESK_PASSWORD ?? "changeme";
  if (!password || password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = process.env.CLAWDESK_SECRET ?? "clawdesk-insecure-default";

  const res = NextResponse.json({ ok: true });
  res.cookies.set("clawdesk-auth", token, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
