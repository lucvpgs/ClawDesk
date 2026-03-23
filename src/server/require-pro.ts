/**
 * Middleware helper for Pro-gated API routes.
 *
 * Usage in any route handler:
 *   const block = requirePro();
 *   if (block) return block;
 *   // ... proceed with Pro logic
 */
import { NextResponse } from "next/server";
import { isProActivated } from "./license-server";

export function requirePro(): NextResponse | null {
  if (isProActivated()) return null;
  return NextResponse.json(
    { error: "ClawDesk Pro license required", code: "PRO_REQUIRED" },
    { status: 403 }
  );
}
