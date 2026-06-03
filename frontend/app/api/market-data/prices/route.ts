import { NextResponse } from "next/server";
import { marketDataManager } from "@/lib/market-data-engine";

export async function GET() {
  return NextResponse.json({
    success: true,
    prices: marketDataManager.getCachedPrices(),
    count: marketDataManager.getCachedPrices().length,
    message: "Price cache is ready. Real feeds will be connected later.",
  });
}