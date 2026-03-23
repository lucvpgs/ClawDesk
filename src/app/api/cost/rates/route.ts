/**
 * GET  /api/cost/rates  — returns merged default + user override rates
 * PATCH /api/cost/rates — saves a single model override to ~/.openclaw/clawdesk.json
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePro } from "@/server/require-pro";
import {
  getMergedRates,
  readRateOverrides,
  writeRateOverrides,
} from "@/server/cost-utils";

export async function GET() {
  const block = requirePro(); if (block) return block;
  const overrides = readRateOverrides();
  const rates     = getMergedRates();
  return NextResponse.json({ rates, overrides });
}

export async function PATCH(req: NextRequest) {
  const block = requirePro(); if (block) return block;
  try {
    const body = await req.json() as { key: string; input: number; output: number };
    const overrides = readRateOverrides();
    overrides[body.key] = { input: body.input, output: body.output };
    writeRateOverrides(overrides);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
