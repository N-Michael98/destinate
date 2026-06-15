export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSettings } from "../../../lib/settings/settings-store";
import { isCapitalConnected, getCapitalSession } from "../../../lib/capital-com/capital-com-session";
import { capitalGetTopMarkets } from "../../../lib/capital-com/capital-com-client";
import { analyzeMarkets } from "../../../lib/market-scanner/ai-analysis-engine";
import { executeCapitalDemoOrder } from "../../../lib/capital-com/capital-com-execution";
import { cacheGet, cacheSet } from "../../../lib/cache/redis-cache";

type TradingStyle = "DAYTRADING" | "SCALPING" | "SWING";
declare global {
  var __daily_trades__: { date: string; count: number; byStyle: Record<string, number> } | undefined;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function ensureDailyTrades() {
  const today = todayStr();
  if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
    global.__daily_trades__ = { date: today, count: 0, byStyle: {} };
  }
  return global.__daily_trades__;
}

function getDailyTradeCount(style?: TradingStyle): number {
  const d = ensureDailyTrades();
  return style ? (d.byStyle[style] ?? 0) : d.count;
}

function incrementDailyTradeCount(style: TradingStyle): void {
  const d = ensureDailyTrades();
  d.count++;
  d.byStyle[style] = (d.byStyle[style] ?? 0) + 1;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { opportunities?: unknown[] };
    const settings = await getSettings();
    const { botSettings, riskSettings } = settings;

    // Only run in AUTO mode
    if (botSettings.mode !== "AUTO") {
      return NextResponse.json({ ok: false, reason: "Bot Mode ist MANUAL — kein Auto-Execute" });
    }

    if (!isCapitalConnected()) {
      return NextResponse.json({ ok: false, reason: "Capital.com nicht verbunden" });
    }

    const session = getCapitalSession()!;
    const accountBalance = session.balance > 0 ? session.balance : 10000;
    const currency = session.currency ?? "USD";

    // Check daily trade limit
    const dailyCount = getDailyTradeCount();
    if (dailyCount >= botSettings.maxTradesPerDay) {
      return NextResponse.json({ ok: false, reason: `Tageslimit erreicht: ${dailyCount}/${botSettings.maxTradesPerDay} Trades` });
    }

    // Check open positions limit
    const positionCacheKey = "auto_exec:open_positions";
    const cachedPositions = await cacheGet<number>(positionCacheKey);
    const openPositions = cachedPositions ?? 0;
    if (openPositions >= botSettings.maxConcurrentPositions) {
      return NextResponse.json({ ok: false, reason: `Max. offene Positionen erreicht: ${openPositions}/${botSettings.maxConcurrentPositions}` });
    }

    // Use pre-analyzed opportunities from scanner if provided, otherwise re-scan
    let opportunities: Awaited<ReturnType<typeof analyzeMarkets>>;
    if (body.opportunities && Array.isArray(body.opportunities) && body.opportunities.length > 0) {
      opportunities = body.opportunities as Awaited<ReturnType<typeof analyzeMarkets>>;
    } else {
      const markets = await capitalGetTopMarkets(session.apiKey, session.cst, session.securityToken);
      if (!markets.ok || !markets.markets?.length) {
        return NextResponse.json({ ok: false, reason: "Keine Märkte von Capital.com erhalten" });
      }
      opportunities = await analyzeMarkets(markets.markets);
    }

    const threshold = botSettings.autoApproveThreshold ?? 80;
    const minConfidence = riskSettings.minConfidenceScore ?? 65;

    const styleLimit = botSettings.maxTradesPerDayByStyle ?? { DAYTRADING: 3, SCALPING: 5, SWING: 2 };

    // Find best GO signal meeting threshold + per-style daily limit not exceeded
    const goSignals = opportunities.filter((o) => {
      if (!o.goSignal) return false;
      if (o.gpt.confidence < threshold) return false;
      if (o.gpt.confidence < minConfidence) return false;
      const style = (o.gpt.tradingStyle ?? "DAYTRADING").toUpperCase() as TradingStyle;
      const styleMax = styleLimit[style] ?? 999;
      if (getDailyTradeCount(style) >= styleMax) return false;
      return true;
    });

    if (!goSignals.length) {
      const styleCounts = Object.entries(styleLimit).map(
        ([s, max]) => `${s}: ${getDailyTradeCount(s as TradingStyle)}/${max}`
      ).join(", ");
      return NextResponse.json({
        ok: false,
        reason: `Kein GO-Signal mit Confidence ≥ ${threshold}% gefunden (Stil-Limits: ${styleCounts})`,
        scanned: opportunities.length,
        analyzed: opportunities.length,
        goCount: opportunities.filter((o) => o.goSignal).length,
      });
    }

    // Execute best signal only (rank 1)
    const best = goSignals[0];
    const bestStyle = (best.gpt.tradingStyle ?? "DAYTRADING").toUpperCase() as TradingStyle;
    const result = await executeCapitalDemoOrder({
      symbol: best.symbol,
      direction: best.gpt.direction as "BUY" | "SELL",
      riskPercent: Math.min(best.claude.maxRiskPercent, riskSettings.maxRiskPerTradePct),
      accountBalance,
      confidence: best.gpt.confidence,
      strategy: best.gpt.tradingStyle,
      tradingStyle: bestStyle,
    });

    if (result.ok) {
      incrementDailyTradeCount(bestStyle);
      await cacheSet(positionCacheKey, openPositions + 1, 300);
      console.log(`[auto-execute] ✅ ${best.symbol} ${best.gpt.direction} (${bestStyle}) — DealID: ${result.dealId} | ${getDailyTradeCount(bestStyle)}/${styleLimit[bestStyle]} ${bestStyle} heute`);
    } else {
      console.error(`[auto-execute] ❌ ${best.symbol} failed: ${result.error}`);
    }

    return NextResponse.json({
      ok: result.ok,
      executed: result.ok,
      symbol: best.symbol,
      direction: best.gpt.direction,
      confidence: best.gpt.confidence,
      size: result.size,
      dealId: result.dealId,
      error: result.error,
      accountBalance,
      currency,
      dailyTradesUsed: getDailyTradeCount(),
      dailyTradesMax: botSettings.maxTradesPerDay,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}

// GET — status report
export async function GET() {
  const settings = await getSettings();
  const session = getCapitalSession();
  return NextResponse.json({
    ok: true,
    botMode: settings.botSettings.mode,
    autoApproveThreshold: settings.botSettings.autoApproveThreshold,
    maxTradesPerDay: settings.botSettings.maxTradesPerDay,
    maxConcurrentPositions: settings.botSettings.maxConcurrentPositions,
    dailyTradesUsed: getDailyTradeCount(),
    dailyTradesByStyle: {
      DAYTRADING: getDailyTradeCount("DAYTRADING"),
      SCALPING: getDailyTradeCount("SCALPING"),
      SWING: getDailyTradeCount("SWING"),
    },
    capitalConnected: isCapitalConnected(),
    accountBalance: session?.balance ?? null,
    currency: session?.currency ?? null,
  });
}
