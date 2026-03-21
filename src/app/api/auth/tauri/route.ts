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

  // Use an HTML page with JS redirect instead of a server-side 3xx redirect.
  // WKWebView (macOS) can silently drop Set-Cookie headers on redirect responses,
  // so we serve the cookie on a real HTML response and let JS navigate to "/".
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script>window.location.replace("/");</script>
</head><body>Logging in…</body></html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  res.cookies.set("clawdesk-auth", secret, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 365, // 1 year — stays valid as long as app is installed
  });
  return res;
}
