import { NextResponse } from "next/server";
import { marketDataManager } from "@/lib/market-data-engine";
import { regimeManager } from "@/lib/market-regime-engine";

export async function GET() {
  try {
    const prices = marketDataManager.refreshPrices();

    const regimes = prices.map((price) =>
      regimeManager.getRegime(
        price.symbol,
        Number(((price.bid + price.ask) / 2).toFixed(5)),
        price.spread
      )
    );

    return NextResponse.json({
      success: true,
      regimes,
      prices,
      count: regimes.length,
      source: "MOCK_LIVE_MARKET_DATA_ENGINE",
      message:
        "Market Regime now classifies from dynamic Market Data Engine prices. Real broker feeds can be connected later.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to classify live market regimes",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
