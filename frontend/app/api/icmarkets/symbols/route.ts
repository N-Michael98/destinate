export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { icListTools, icGetSymbolId } from "@/lib/icmarkets/icmarkets-client";

// All symbols we trade
const OUR_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF",
  "GBPJPY", "EURJPY", "EURGBP", "NZDUSD",
  "US100", "US500", "GER40", "UK100", "NAS100", "SPX500",
  "GOLD", "XAUUSD", "XAGUSD", "SILVER", "OIL", "USOIL",
];

export async function GET() {
  try {
    // Step 1: List available tools
    const tools = await icListTools();

    // Step 2: Try to resolve symbolId for each of our symbols
    const results: Record<string, number | null> = {};
    for (const sym of OUR_SYMBOLS) {
      results[sym] = await icGetSymbolId(sym).catch(() => null);
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

    return NextResponse.json({
      ok: true,
      availableTools: tools,
      symbolIds: results,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
