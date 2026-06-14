export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { marketDataManager } from "@/lib/market-data-engine";
import { regimeManager } from "@/lib/market-regime-engine";

export async function GET() {
  try {
    const prices = marketDataManager.refreshPrices();

    const regimes = prices.map((price) => {
      const midpoint = Number(((price.bid + price.ask) / 2).toFixed(5));
      const previousMidpoint =
        price.previousBid !== undefined && price.previousAsk !== undefined
          ? Number(((price.previousBid + price.previousAsk) / 2).toFixed(5))
          : null;

      return regimeManager.getRegime(
        price.symbol,
        midpoint,
        price.spread,
        previousMidpoint
      );
    });

    return NextResponse.json({
      success: true,
      regimes,
      prices,
      count: regimes.length,
      source: "MOCK_LIVE_REAL_REGIME_ENGINE",
      message:
        "Real Market Regime Engine uses dynamic price movement, momentum, volatility and risk classification.",
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
