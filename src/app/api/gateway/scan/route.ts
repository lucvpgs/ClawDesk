import { NextResponse } from "next/server";
import { scanLocalOpenClaw } from "@/server/connector/openclaw-scan";

export async function GET() {
  const result = scanLocalOpenClaw();
  return NextResponse.json(result);
}
