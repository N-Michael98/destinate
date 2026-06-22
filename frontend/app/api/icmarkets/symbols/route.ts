export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { icListTools, icGetSymbolId } from "@/lib/icmarkets/icmarkets-client";

const OUR_SYMBOLS = [
  "EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF",
  "GBPJPY","EURJPY","EURGBP","NZDUSD",
  "US100","US500","GER40","UK100","NAS100","SPX500","DE40","USTEC","NAS100_USD",
  "XAUUSD","XAGUSD","GOLD","SILVER","USOIL","OIL","BRENT","WTI","XTIUSD","CRUDE",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase();

  try {
    const tools = await icListTools();

    // Trigger cache population
    await icGetSymbolId("EURUSD").catch(() => null);

    // Get symbolIds for our known symbols
    const symbolIds: Record<string, number | null> = {};
    for (const sym of OUR_SYMBOLS) {
      symbolIds[sym] = await icGetSymbolId(sym).catch(() => null);
      await new Promise(r => setTimeout(r, 50));
    }

    // If search param provided, also search via exported cache
    const { icSearchSymbols } = await import("@/lib/icmarkets/icmarkets-client");
    const searchResults = search ? icSearchSymbols(search) : {};

    return NextResponse.json({ ok: true, availableTools: tools, symbolIds, searchResults });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
