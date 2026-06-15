export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSettings } from "../../../lib/settings/settings-store";
import { isCapitalConnected, getCapitalSession } from "../../../lib/capital-com/capital-com-session";
import { capitalGetTopMarkets } from "../../../lib/capital-com/capital-com-client";
import { analyzeMarkets } from "../../../lib/market-scanner/ai-analysis-engine";
import { executeCapitalDemoOrder } from "../../../lib/capital-com/capital-com-execution";
import { cacheGet, cacheSet } from "../../../lib/cache/redis-cache";

// Track daily trade count in memory (resets on redeploy, good enough for DEMO)
declare global { var __daily_trades__: { date: string; count: number } | undefined; }

function getDailyTradeCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
    global.__daily_trades__ = { date: today, count: 0 };
  }
  return global.__daily_trades__.count;
}

function incrementDailyTradeCount(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
    global.__daily_trades__ = { date: today, count: 1 };
  } else {
    global.__daily_trades__.count++;
  }
}

export async function POST() {
  try {
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

    // Scan markets
    const markets = await capitalGetTopMarkets(session.apiKey, session.cst, session.securityToken);
    if (!markets.ok || !markets.markets?.length) {
      return NextResponse.json({ ok: false, reason: "Keine Märkte von Capital.com erhalten" });
    }

    // AI Analysis
    const opportunities = await analyzeMarkets(markets.markets);
    const threshold = botSettings.autoApproveThreshold ?? 80;
    const minConfidence = riskSettings.minConfidenceScore ?? 65;

    // Find best GO signal meeting AUTO threshold
    const goSignals = opportunities.filter(
      (o) => o.goSignal && o.gpt.confidence >= threshold && o.gpt.confidence >= minConfidence
    );

    if (!goSignals.length) {
      return NextResponse.json({
        ok: false,
        reason: `Kein GO-Signal mit Confidence ≥ ${threshold}% gefunden`,
        scanned: markets.markets.length,
        analyzed: opportunities.length,
        goCount: opportunities.filter((o) => o.goSignal).length,
      });
    }

    // Execute best signal only (rank 1)
    const best = goSignals[0];
    const result = await executeCapitalDemoOrder({
      symbol: best.symbol,
      direction: best.gpt.direction as "BUY" | "SELL",
      riskPercent: Math.min(best.claude.maxRiskPercent, riskSettings.maxRiskPerTradePct),
      accountBalance,
      confidence: best.gpt.confidence,
      strategy: best.gpt.tradingStyle,
      tradingStyle: best.gpt.tradingStyle as "SCALPING" | "DAYTRADING" | "SWING",
    });

    if (result.ok) {
      incrementDailyTradeCount();
      await cacheSet(positionCacheKey, openPositions + 1, 300); // 5 min cache

      console.log(`[auto-execute] ✅ ${best.symbol} ${best.gpt.direction} executed — DealID: ${result.dealId} | Balance: ${accountBalance} ${currency}`);
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
    capitalConnected: isCapitalConnected(),
    accountBalance: session?.balance ?? null,
    currency: session?.currency ?? null,
  });
}
