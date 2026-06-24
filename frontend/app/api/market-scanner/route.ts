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

    // Return last server-side auto-scan results (no re-scan needed)
    if (action === "last") {
      const last = global.__last_scan_result__;
      if (!last) return NextResponse.json({ ok: false, reason: "Noch kein Auto-Scan gelaufen" });
      return NextResponse.json({ ok: true, ...last, fromCache: true });
    }

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
      // Kein Capital.com — versuche Python Backend für echte Preise
      try {
        const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";
        const FALLBACK_SYMBOLS = ["XAUUSD", "EURUSD", "NAS100", "USOIL", "BTCUSD", "SPX500", "GBPUSD", "XAGUSD", "GER40", "UK100"];
        if (PYTHON_BASE) {
          const res = await fetch(`${PYTHON_BASE}/api/v1/market/price/multi`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols: FALLBACK_SYMBOLS }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            const data = await res.json() as { prices?: Array<{ symbol: string; bid: number; ask: number }> };
            const META: Record<string, { epic: string; name: string; type: string }> = {
              XAUUSD: { epic: "GOLD",     name: "Gold",        type: "COMMODITIES" },
              EURUSD: { epic: "EURUSD",   name: "EUR/USD",     type: "CURRENCIES" },
              NAS100: { epic: "US100",    name: "Nasdaq 100",  type: "INDICES" },
              USOIL:  { epic: "OIL_CRUDE",name: "Crude Oil",   type: "COMMODITIES" },
              BTCUSD: { epic: "BITCOIN",  name: "Bitcoin",     type: "CRYPTOCURRENCIES" },
              SPX500: { epic: "US500",    name: "S&P 500",     type: "INDICES" },
              GBPUSD: { epic: "GBPUSD",  name: "GBP/USD",     type: "CURRENCIES" },
              XAGUSD: { epic: "SILVER",  name: "Silver",      type: "COMMODITIES" },
              GER40:  { epic: "GERMANY40",name: "DAX 40",     type: "INDICES" },
              UK100:  { epic: "UK100",   name: "FTSE 100",    type: "INDICES" },
            };
            markets = (data.prices ?? [])
              .filter(p => p.bid > 0)
              .map(p => ({
                epic:           META[p.symbol]?.epic ?? p.symbol,
                instrumentName: META[p.symbol]?.name ?? p.symbol,
                instrumentType: META[p.symbol]?.type ?? "COMMODITIES",
                symbol:         p.symbol,
                bid:            p.bid,
                ask:            p.ask,
                spread:         Number((p.ask - p.bid).toFixed(5)),
                updateTime:     new Date().toISOString(),
              }));
          }
        }
      } catch { /* non-fatal */ }
    }

    // Run AI analysis on all markets
    const opportunities = await analyzeMarkets(markets ?? []);
    const goSignals = opportunities.filter((o) => o.goSignal);

    // Cache for scanner UI and server-side auto-scan display
    global.__last_scan_result__ = { opportunities, updatedAt: new Date().toISOString() };

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
