export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSettings } from "../../../lib/settings/settings-store";
import { isCapitalConnected, getCapitalSession } from "../../../lib/capital-com/capital-com-session";
import { capitalGetTopMarkets } from "../../../lib/capital-com/capital-com-client";
import { analyzeMarkets } from "../../../lib/market-scanner/ai-analysis-engine";
import { executeCapitalDemoOrder } from "../../../lib/capital-com/capital-com-execution";
import { executeICMarketsOrder } from "../../../lib/icmarkets/icmarkets-execution";
import { isICMarketsConnected, getICMarketsSession } from "../../../lib/icmarkets/icmarkets-session";
import { cacheGet, cacheSet } from "../../../lib/cache/redis-cache";

type TradingStyle = "DAYTRADING" | "SCALPING" | "SWING";
declare global {
  var __daily_trades__: { date: string; count: number; byStyle: Record<string, number> } | undefined;
  var __last_scan_result__: { opportunities: unknown[]; updatedAt: string } | undefined;
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

    // Check daily trade limit (only if tradeLimitEnabled)
    const tradeLimitEnabled = botSettings.tradeLimitEnabled ?? true;
    const bypassScore = botSettings.tradeLimitBypassScore ?? 80;
    const dailyCount = getDailyTradeCount();
    const limitReached = dailyCount >= botSettings.maxTradesPerDay;
    if (tradeLimitEnabled && limitReached) {
      // Still allow if best signal has bypass score — filter is applied later in goSignals
      // For now just log it, don't hard-block
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

    // Find best GO signal — respect tradeLimitEnabled + bypass rule
    const goSignals = opportunities.filter((o) => {
      if (!o.goSignal) return false;
      if (o.gpt.confidence < minConfidence) return false;
      const style = (o.gpt.tradingStyle ?? "DAYTRADING").toUpperCase() as TradingStyle;
      const styleMax = styleLimit[style] ?? 999;
      if (getDailyTradeCount(style) >= styleMax) return false;
      // Daily limit: OFF = no limit; ON + limit reached = require bypass score; ON + not reached = use threshold
      if (!tradeLimitEnabled) return o.gpt.confidence >= threshold;
      if (limitReached) return o.gpt.confidence >= bypassScore;
      return o.gpt.confidence >= threshold;
    });

    if (!goSignals.length) {
      const limitMsg = tradeLimitEnabled && limitReached
        ? `Tageslimit ${dailyCount}/${botSettings.maxTradesPerDay} erreicht — kein Signal ≥ ${bypassScore}% Bypass`
        : `Kein GO-Signal mit Confidence ≥ ${threshold}%`;
      const styleCounts = Object.entries(styleLimit).map(
        ([s, max]) => `${s}: ${getDailyTradeCount(s as TradingStyle)}/${max}`
      ).join(", ");
      return NextResponse.json({
        ok: false,
        reason: `${limitMsg} (Stil-Limits: ${styleCounts})`,
        scanned: opportunities.length,
        analyzed: opportunities.length,
        goCount: opportunities.filter((o) => o.goSignal).length,
      });
    }

    // Execute best signal only (rank 1)
    const best = goSignals[0];
    const bestStyle = (best.gpt.tradingStyle ?? "DAYTRADING").toUpperCase() as TradingStyle;
    const riskPct = Math.min(best.claude.maxRiskPercent, riskSettings.maxRiskPerTradePct);

    // Execute on Capital.com + IC Markets in parallel (Option A: both brokers)
    const icSession = getICMarketsSession();
    const [result, icResult] = await Promise.all([
      executeCapitalDemoOrder({
        symbol: best.symbol,
        direction: best.gpt.direction as "BUY" | "SELL",
        riskPercent: riskPct,
        accountBalance,
        stopLossPrice: best.gpt.stopLoss,
        takeProfitPrice: best.gpt.takeProfit,
        confidence: best.gpt.confidence,
        strategy: best.gpt.tradingStyle,
        tradingStyle: bestStyle,
      }),
      isICMarketsConnected() ? executeICMarketsOrder({
        symbol: best.symbol,
        direction: best.gpt.direction as "BUY" | "SELL",
        riskPercent: riskPct,
        accountBalance: icSession?.balance ?? accountBalance,
        stopLossPrice: best.gpt.stopLoss,
        takeProfitPrice: best.gpt.takeProfit,
        confidence: best.gpt.confidence,
        tradingStyle: bestStyle,
      }) : Promise.resolve(null),
    ]);

    if (result.ok) {
      incrementDailyTradeCount(bestStyle);
      await cacheSet(positionCacheKey, openPositions + 1, 300);
      const icLog = icResult ? (icResult.ok ? `IC:✅${icResult.positionId}` : `IC:❌${icResult.error}`) : "IC:not connected";
      console.log(`[auto-execute] ✅ ${best.symbol} ${best.gpt.direction} (${bestStyle}) — Capital:${result.dealId} | ${icLog} | ${getDailyTradeCount(bestStyle)}/${styleLimit[bestStyle]} heute`);
      // Telegram notification
      try {
        const { notifyTradeExecuted } = await import("../../../lib/telegram-notifications/telegram-sender");
        const brokerLabel = icResult?.ok ? "Capital.com + IC Markets" : "Capital.com";
        await notifyTradeExecuted({
          symbol: best.symbol,
          direction: best.gpt.direction as "BUY" | "SELL",
          size: result.size ?? 0,
          entry: result.openLevel ?? 0,
          stopLoss: best.gpt.stopLoss ?? 0,
          takeProfit: best.gpt.takeProfit ?? 0,
          confidence: best.gpt.confidence,
          broker: brokerLabel,
          dealId: result.dealId,
        });
      } catch { /* non-fatal */ }
      // Save to Trading Journal
      try {
        const { saveCapitalTradeToJournal } = await import("../../../lib/capital-com/capital-trade-tracker");
        await saveCapitalTradeToJournal({
          dealId: result.dealId ?? "unknown",
          symbol: best.symbol,
          direction: best.gpt.direction as "BUY" | "SELL",
          tradingStyle: bestStyle,
          strategy: best.gpt.tradingStyle ?? bestStyle,
          entry: result.openLevel ?? (best.gpt as { entryPrice?: number }).entryPrice ?? 0,
          stopLoss: best.gpt.stopLoss ?? 0,
          takeProfit: best.gpt.takeProfit ?? 0,
          size: result.size,
          accountBalance,
          riskPercent: riskSettings.maxRiskPerTradePct,
          confidence: best.gpt.confidence,
          icPositionId: icResult?.ok ? icResult.positionId : undefined,
        });
      } catch { /* non-fatal */ }
    } else {
      console.error(`[auto-execute] ❌ ${best.symbol} Capital failed: ${result.error}`);
    }

    if (icResult && !icResult.ok) {
      console.error(`[auto-execute] ❌ ${best.symbol} IC Markets failed: ${icResult.error}`);
    }

    return NextResponse.json({
      ok: result.ok,
      executed: result.ok,
      symbol: best.symbol,
      direction: best.gpt.direction,
      confidence: best.gpt.confidence,
      size: result.size,
      dealId: result.dealId,
      icMarketsPositionId: icResult?.positionId ?? null,
      icMarketsOk: icResult?.ok ?? false,
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
