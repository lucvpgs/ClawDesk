/**
 * GET  /api/license         — returns Pro status from disk
 * POST /api/license/activate — validates + persists key to clawdesk.json
 * POST /api/license/deactivate — removes key from clawdesk.json
 */
import { NextRequest, NextResponse } from "next/server";
import { isProActivated, getActivatedKey, activateLicense, deactivateLicense } from "@/server/license-server";

export async function GET() {
  const key = getActivatedKey();
  return NextResponse.json({ isPro: key !== null, key });
}

export async function POST(req: NextRequest) {
  try {
    const { action, key } = await req.json() as { action?: string; key?: string };

    if (action === "deactivate") {
      deactivateLicense();
      return NextResponse.json({ ok: true, isPro: false });
    }

    if (!key || typeof key !== "string") {
      return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });
    }

    const ok = activateLicense(key);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid license key" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, isPro: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
