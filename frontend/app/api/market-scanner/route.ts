export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getCapitalSession, isCapitalConnected } from "../../../lib/capital-com/capital-com-session";
import { capitalGetTopMarkets, capitalSearchMarkets, type CapitalMarket } from "../../../lib/capital-com/capital-com-client";
import { analyzeMarkets } from "../../../lib/market-scanner/ai-analysis-engine";
import { getAISettings } from "../../../lib/ai-config/ai-config-store";
import { cacheGetOrFetch } from "../../../lib/cache/redis-cache";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "scan";
    const searchTerm = searchParams.get("q") ?? "";
    const types = searchParams.get("types") ?? "CURRENCIES,INDICES,COMMODITIES,CRYPTOCURRENCIES";

    const ai = await getAISettings();
    const capitalConnected = isCapitalConnected();
    const session = getCapitalSession();

    if (action === "status") {
      return NextResponse.json({
        ok: true,
        capitalConnected,
        gptConnected: ai.openai.connected,
        claudeConnected: ai.anthropic.connected,
        gptModel: ai.openai.model,
        claudeModel: ai.anthropic.model,
        realAnalysis: ai.openai.connected || ai.anthropic.connected,
      });
    }

    // Fetch markets from Capital.com or use fallback list
    let markets: CapitalMarket[] = [];

    if (capitalConnected && session) {
      const instrumentTypes = types.split(",").map((t) => t.trim());
      const cacheKey = `markets:${instrumentTypes.sort().join(",")}:${searchTerm}`;
      const result = await cacheGetOrFetch(cacheKey, async () => {
        const r = searchTerm
          ? await capitalSearchMarkets(session!.apiKey, session!.cst, session!.securityToken, searchTerm)
          : await capitalGetTopMarkets(session!.apiKey, session!.cst, session!.securityToken, instrumentTypes);
        return r.markets ?? [];
      }, 30); // cache 30 seconds
      markets = result;
    } else {
      // Fallback: static market list with simulated prices
      const FALLBACK_EPICS = [
        { epic: "GOLD", instrumentName: "Gold", instrumentType: "COMMODITIES", symbol: "XAUUSD", bid: 2340, ask: 2340.5, spread: 0.5, updateTime: new Date().toISOString() },
        { epic: "EURUSD", instrumentName: "EUR/USD", instrumentType: "CURRENCIES", symbol: "EURUSD", bid: 1.0848, ask: 1.0850, spread: 0.0002, updateTime: new Date().toISOString() },
        { epic: "US100", instrumentName: "Nasdaq 100", instrumentType: "INDICES", symbol: "NAS100", bid: 19180, ask: 19182, spread: 2, updateTime: new Date().toISOString() },
        { epic: "OIL_CRUDE", instrumentName: "Crude Oil", instrumentType: "COMMODITIES", symbol: "USOIL", bid: 78.45, ask: 78.50, spread: 0.05, updateTime: new Date().toISOString() },
        { epic: "BITCOIN", instrumentName: "Bitcoin", instrumentType: "CRYPTOCURRENCIES", symbol: "BTCUSD", bid: 67480, ask: 67500, spread: 20, updateTime: new Date().toISOString() },
        { epic: "US500", instrumentName: "S&P 500", instrumentType: "INDICES", symbol: "SPX500", bid: 5448, ask: 5450, spread: 2, updateTime: new Date().toISOString() },
        { epic: "GBPUSD", instrumentName: "GBP/USD", instrumentType: "CURRENCIES", symbol: "GBPUSD", bid: 1.2700, ask: 1.2702, spread: 0.0002, updateTime: new Date().toISOString() },
        { epic: "SILVER", instrumentName: "Silver", instrumentType: "COMMODITIES", symbol: "SILVER", bid: 29.50, ask: 29.55, spread: 0.05, updateTime: new Date().toISOString() },
      ];
      markets = FALLBACK_EPICS;
    }

    // Run AI analysis on all markets
    const opportunities = await analyzeMarkets(markets ?? []);
    const goSignals = opportunities.filter((o) => o.goSignal);

    return NextResponse.json({
      ok: true,
      capitalConnected,
      gptConnected: ai.openai.connected,
      claudeConnected: ai.anthropic.connected,
      totalMarkets: markets?.length ?? 0,
      opportunities,
      goSignals,
      goCount: goSignals.length,
      scannedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
