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

    // ── Gemeinsame Watchlist + META für Supplement ───────────────────────────
    const WATCHLIST_SYMBOLS = [
      "NAS100","SPX500","UK100","GER40","DJ30","JPN225",
      "XAUUSD","USOIL","UKOIL","XAGUSD","NATGAS",
      "EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","EURGBP","GBPJPY","EURJPY",
      "BTCUSD","ETHUSD",
    ];
    const PYTHON_BASE = process.env.PYTHON_BACKEND_NEW_URL ?? process.env.PYTHON_BACKEND_URL ?? "";

    async function supplementFromPython(existing: CapitalMarket[]): Promise<CapitalMarket[]> {
      const existingSymbols = new Set(existing.map(m => m.symbol));
      const missing = WATCHLIST_SYMBOLS.filter(s => !existingSymbols.has(s));
      if (!missing.length || !PYTHON_BASE) return existing;
      try {
        const res = await fetch(`${PYTHON_BASE}/api/v1/market/price/multi`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: missing }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return existing;
        const data = await res.json() as { prices?: Array<{ symbol: string; price: number | null }> };
        const supplemented = [...existing];
        for (const p of data.prices ?? []) {
          if (!p.price || p.price <= 0) continue;
          const META: Record<string, { epic: string; name: string; type: string }> = {
            NAS100:{epic:"US100",name:"Nasdaq 100",type:"INDICES"}, SPX500:{epic:"US500",name:"S&P 500",type:"INDICES"},
            UK100:{epic:"UK100",name:"FTSE 100",type:"INDICES"}, GER40:{epic:"GERMANY40",name:"DAX 40",type:"INDICES"},
            DJ30:{epic:"US30",name:"Dow Jones",type:"INDICES"}, JPN225:{epic:"JAPAN225",name:"Nikkei 225",type:"INDICES"},
            XAUUSD:{epic:"GOLD",name:"Gold",type:"COMMODITIES"}, USOIL:{epic:"OIL_CRUDE",name:"Crude Oil",type:"COMMODITIES"},
            UKOIL:{epic:"OIL_BRENT",name:"Brent Oil",type:"COMMODITIES"}, XAGUSD:{epic:"SILVER",name:"Silver",type:"COMMODITIES"},
            NATGAS:{epic:"NATURAL_GAS",name:"Natural Gas",type:"COMMODITIES"},
            EURUSD:{epic:"EURUSD",name:"EUR/USD",type:"CURRENCIES"}, GBPUSD:{epic:"GBPUSD",name:"GBP/USD",type:"CURRENCIES"},
            USDJPY:{epic:"USDJPY",name:"USD/JPY",type:"CURRENCIES"}, USDCHF:{epic:"USDCHF",name:"USD/CHF",type:"CURRENCIES"},
            AUDUSD:{epic:"AUDUSD",name:"AUD/USD",type:"CURRENCIES"}, USDCAD:{epic:"USDCAD",name:"USD/CAD",type:"CURRENCIES"},
            EURGBP:{epic:"EURGBP",name:"EUR/GBP",type:"CURRENCIES"}, GBPJPY:{epic:"GBPJPY",name:"GBP/JPY",type:"CURRENCIES"},
            EURJPY:{epic:"EURJPY",name:"EUR/JPY",type:"CURRENCIES"},
            BTCUSD:{epic:"BITCOIN",name:"Bitcoin",type:"CRYPTOCURRENCIES"}, ETHUSD:{epic:"ETHEREUM",name:"Ethereum",type:"CRYPTOCURRENCIES"},
          };
          const meta = META[p.symbol];
          if (!meta) continue;
          const spreadPct = meta.type === "CURRENCIES" ? 0.0002 : meta.type === "CRYPTOCURRENCIES" ? 0.001 : 0.0005;
          const half = p.price * spreadPct / 2;
          supplemented.push({
            epic: meta.epic, instrumentName: meta.name, instrumentType: meta.type, symbol: p.symbol,
            bid: Number((p.price - half).toFixed(5)), ask: Number((p.price + half).toFixed(5)),
            spread: Number((half * 2).toFixed(5)), updateTime: new Date().toISOString(),
          });
        }
        console.log(`[market-scanner] ${existing.length} Capital.com + ${supplemented.length - existing.length} Python = ${supplemented.length} total`);
        return supplemented;
      } catch { return existing; }
    }

    // Fetch markets from Capital.com — immer mit Python-Supplement für fehlende Symbole
    let markets: CapitalMarket[] = [];

    if (capitalConnected && session) {
      const instrumentTypes = types.split(",").map((t) => t.trim());
      const cacheKey = `markets:${instrumentTypes.sort().join(",")}:${searchTerm}`;
      const capitalMarkets = await cacheGetOrFetch(cacheKey, async () => {
        const r = searchTerm
          ? await capitalSearchMarkets(session!.apiKey, session!.cst, session!.securityToken, searchTerm)
          : await capitalGetTopMarkets(session!.apiKey, session!.cst, session!.securityToken, instrumentTypes);
        return r.markets ?? [];
      }, 30);
      // Fehlende Symbole immer ergänzen — auch wenn Capital.com verbunden
      markets = searchTerm ? capitalMarkets : await supplementFromPython(capitalMarkets);
    } else {
      // Kein Capital.com — alle 22 Watchlist-Symbole von Python Backend
      markets = await supplementFromPython([]);
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
