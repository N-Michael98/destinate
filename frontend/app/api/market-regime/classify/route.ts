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

    // Woher die Kurse kommen, gehört in die Antwort (26.08.). Bis heute las
    // diese Route einen Cache, den NIEMAND füllte — sie lieferte also immer
    // `regimes: []` und die Oberfläche zeigte dazu "Live" und "Engine Online".
    // Jetzt füllt der Handelszyklus den Cache; bleibt er trotzdem leer, sagt
    // die Antwort das, statt eine leere Liste als Ergebnis auszugeben.
    const ageMinutes = marketDataManager.cacheAlterMinuten();

    return NextResponse.json({
      success: true,
      regimes,
      prices,
      count: regimes.length,
      ageMinutes,
      source: prices.length > 0 ? "LIVE_REGIME_ENGINE" : "NO_PRICES",
      message:
        prices.length > 0
          ? `Regime aus ${prices.length} Kursen im Preis-Cache (jüngster ${ageMinutes} Min alt).`
          : "Keine Kurse im Preis-Cache — der Handelszyklus hat noch nichts "
            + "abgelegt (oder die Einträge sind abgelaufen). Ohne Kurs wird "
            + "kein Regime eingestuft.",
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
