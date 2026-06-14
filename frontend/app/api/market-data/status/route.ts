export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { marketDataManager } from "@/lib/market-data-engine";

export async function GET() {
  return NextResponse.json({
    success: true,
    engine: "MARKET_DATA_ENGINE",
    version: "V9.6.2",
    ready: marketDataManager.isReady(),
    health: marketDataManager.getHealth(),
    cachedPrices: marketDataManager.getCachedPrices(),
    message: "Market Data Engine API is running.",
  });
}