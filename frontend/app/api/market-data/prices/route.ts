import { NextResponse } from "next/server";
import { marketDataManager } from "@/lib/market-data-engine";

export async function GET() {
  const prices = marketDataManager.refreshPrices();

  return NextResponse.json({
    success: true,
    prices,
    count: prices.length,
    source: "MOCK_LIVE_CACHE",
    message:
      "Mock live price cache is running. Real broker feeds will be connected later.",
    updatedAt: new Date().toISOString(),
  });
}