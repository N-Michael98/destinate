export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { marketDataManager } from "@/lib/market-data-engine";

export async function GET() {
  const cachedPrices = marketDataManager.getCachedPrices();
  const ageMinutes = marketDataManager.cacheAlterMinuten();

  return NextResponse.json({
    success: true,
    engine: "MARKET_DATA_ENGINE",
    version: "V9.6.2",
    ready: marketDataManager.isReady(),
    health: marketDataManager.getHealth(),
    cachedPrices,
    count: cachedPrices.length,
    // Alter des jüngsten Kurses (26.08.). Ohne diese Angabe liess sich
    // "der Zyklus füllt gerade" nicht von "der Zyklus steht still" trennen —
    // beide Fälle sahen als Liste identisch aus, solange noch Einträge da
    // waren. null = Cache leer.
    ageMinutes,
    message:
      cachedPrices.length > 0
        ? `${cachedPrices.length} Kurse im Cache, jüngster ${ageMinutes} Min alt.`
        : "Cache leer — der Handelszyklus hat noch keine Kurse abgelegt "
          + "(oder sie sind abgelaufen).",
  });
}
