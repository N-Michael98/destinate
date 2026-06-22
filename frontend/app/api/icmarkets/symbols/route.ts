export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { icGetSymbolId } from "@/lib/icmarkets/icmarkets-client";

// Internal MCP call helper — reuse the same session
async function getRawSymbols(): Promise<unknown> {
  const MCP_URL = process.env.ICMARKETS_MCP_URL ?? "https://mcp.ctrader.com/trading/mcp";
  const MCP_TOKEN = process.env.ICMARKETS_MCP_TOKEN ?? "";

  // We need to get the session ID first — import from client
  const { icListTools } = await import("@/lib/icmarkets/icmarkets-client");
  await icListTools(); // ensures session is initialized

  // Call get_symbols directly via the existing mcpCall (reuse session)
  // We do this by calling icGetSymbolId with a dummy symbol to trigger cache population
  await icGetSymbolId("__probe__").catch(() => null);

  // Now return the cached symbols via a dedicated call
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MCP_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: "get_symbols", arguments: {} },
    }),
  });

  if (!res.ok) return { error: `HTTP ${res.status}` };
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        const json = line.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try { return JSON.parse(json); } catch { /* try next */ }
      }
    }
    return { error: "No valid SSE data", raw: text.slice(0, 500) };
  }
  return res.json();
}

export async function GET() {
  try {
    const data = await getRawSymbols();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
