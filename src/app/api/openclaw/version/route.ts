import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const OPENCLAW_JSON = path.join(process.env.HOME!, ".openclaw", "openclaw.json");
const UPDATE_CHECK  = path.join(process.env.HOME!, ".openclaw", "update-check.json");

export async function GET() {
  try {
    const cfg         = JSON.parse(fs.readFileSync(OPENCLAW_JSON, "utf8"));
    const updateCheck = fs.existsSync(UPDATE_CHECK)
      ? JSON.parse(fs.readFileSync(UPDATE_CHECK, "utf8"))
      : {};

    const openclawVersion: string  = cfg?.meta?.lastTouchedVersion ?? "unknown";
    const lastCheckedAt:   string  = updateCheck?.lastCheckedAt     ?? null;
    const latestAvailable: string  = updateCheck?.latestVersion     ?? null;
    const updateAvailable: boolean = !!latestAvailable && latestAvailable !== openclawVersion;

    return NextResponse.json({
      openclawVersion,
      lastCheckedAt,
      latestAvailable,
      updateAvailable,
      clawdeskVersion: "1.0.0",
    });
  } catch {
    return NextResponse.json(
      { openclawVersion: "unknown", clawdeskVersion: "1.0.0", updateAvailable: false },
      { status: 200 } // soft fail — don't crash the sidebar
    );
  }
}
