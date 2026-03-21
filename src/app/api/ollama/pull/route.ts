/**
 * /api/ollama/pull
 * POST — proxy a model pull request to the local Ollama instance.
 * Streams the NDJSON progress back to the client.
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { baseUrl = "http://localhost:11434", model } = await req.json() as {
    baseUrl?: string;
    model: string;
  };

  if (!model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  const ollamaUrl = `${baseUrl.replace(/\/$/, "")}/api/pull`;

  let ollamaRes: Response;
  try {
    ollamaRes = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      // No timeout — large models can take many minutes
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Cannot reach Ollama at ${baseUrl}: ${String(err)}` },
      { status: 502 }
    );
  }

  if (!ollamaRes.ok) {
    const text = await ollamaRes.text().catch(() => ollamaRes.statusText);
    return NextResponse.json({ error: text }, { status: ollamaRes.status });
  }

  if (!ollamaRes.body) {
    return NextResponse.json({ error: "Empty response from Ollama" }, { status: 502 });
  }

  // Stream the NDJSON response straight through to the browser
  return new Response(ollamaRes.body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
