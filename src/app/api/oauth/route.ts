/**
 * /api/oauth
 * Manages short-lived OAuth state for the custom-oauth provider flow.
 *
 * POST { action: "init",     oauthUrl, clientId?, scope? }
 *   → { state, authUrl, redirectUri }
 *
 * POST { action: "complete", state, token }
 *   → { ok: true }
 *
 * GET  ?state=xxx
 *   → { done: boolean, token: string | null }
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import path from "path";
import crypto from "crypto";

const DIR        = path.join(homedir(), ".openclaw");
const STATES_PATH = path.join(DIR, "oauth-states.json");
const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface OAuthEntry {
  token: string | null;
  createdAt: number;
}
type OAuthStates = Record<string, OAuthEntry>;

function readStates(): OAuthStates {
  try {
    if (!existsSync(STATES_PATH)) return {};
    return JSON.parse(readFileSync(STATES_PATH, "utf-8"));
  } catch { return {}; }
}

function writeStates(s: OAuthStates) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(STATES_PATH, JSON.stringify(s, null, 2), "utf-8");
}

function pruned(s: OAuthStates): OAuthStates {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(s).filter(([, v]) => now - v.createdAt < STATE_TTL_MS)
  );
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    action: "init" | "complete";
    // init
    oauthUrl?: string;
    clientId?: string;
    scope?: string;
    // complete
    state?: string;
    token?: string;
  };

  if (body.action === "init") {
    if (!body.oauthUrl) {
      return NextResponse.json({ error: "oauthUrl required" }, { status: 400 });
    }

    const state = crypto.randomBytes(20).toString("hex");
    const origin = req.nextUrl.origin; // e.g. http://localhost:3131
    const redirectUri = `${origin}/oauth`;

    // Build authorization URL
    const authUrl = new URL(body.oauthUrl);
    authUrl.searchParams.set("response_type", "token"); // implicit grant
    if (body.clientId) authUrl.searchParams.set("client_id", body.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    if (body.scope)    authUrl.searchParams.set("scope", body.scope);

    const states = pruned(readStates());
    states[state] = { token: null, createdAt: Date.now() };
    writeStates(states);

    return NextResponse.json({ state, authUrl: authUrl.toString(), redirectUri });
  }

  if (body.action === "complete") {
    if (!body.state || !body.token) {
      return NextResponse.json({ error: "state and token required" }, { status: 400 });
    }
    const states = readStates();
    if (!states[body.state]) {
      return NextResponse.json({ error: "Unknown or expired state" }, { status: 404 });
    }
    states[body.state].token = body.token;
    writeStates(states);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  if (!state) return NextResponse.json({ error: "state required" }, { status: 400 });

  const states = readStates();
  const entry  = states[state];
  if (!entry) return NextResponse.json({ error: "Unknown or expired state" }, { status: 404 });

  return NextResponse.json({ done: entry.token !== null, token: entry.token });
}
