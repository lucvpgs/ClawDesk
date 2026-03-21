import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/tauri?token=<TAURI_AUTO_LOGIN>
 *
 * Called by the Tauri window on first load.
 * If the token matches the env var set by the Tauri process, this route sets
 * the clawdesk-auth cookie (same as a normal login) and redirects to "/".
 *
 * The token is a random 48-char hex string generated fresh on every app start,
 * so it's safe against replay from outside the local machine.
 */
export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get("token");
  const expected = process.env.TAURI_AUTO_LOGIN;

  // Token must be present, non-empty, and match — otherwise redirect to login
  if (!token || !expected || token !== expected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const secret = process.env.CLAWDESK_SECRET ?? "clawdesk-insecure-default";

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("clawdesk-auth", secret, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 365, // 1 year — stays valid as long as app is installed
  });
  return res;
}
