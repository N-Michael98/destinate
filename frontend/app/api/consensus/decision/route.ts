import { NextResponse } from "next/server";
import { consensusManager } from "@/lib/consensus-engine";
import { fetchIndicatorsMany } from "@/lib/python-bridge/python-data";

const SYMBOLS = ["XAUUSD", "EURUSD", "BTCUSD", "NAS100"];
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET() {
  // Alle drei Datenquellen parallel holen
  const [gptRes, claudeRes, indicators] = await Promise.allSettled([
    fetch(`${BASE_URL}/api/gpt-analyst/analyze`, { cache: "no-store" }).then((r) => r.json()),
    fetch(`${BASE_URL}/api/claude-risk/assess`, { cache: "no-store" }).then((r) => r.json()),
    fetchIndicatorsMany(SYMBOLS, "1h", "1mo"),
  ]);

  const gptAnalyses: Array<{ symbol: string; direction: string; confidence: number }> =
    gptRes.status === "fulfilled" ? (gptRes.value.analyses ?? []) : [];

  const claudeRisks: Array<{ symbol: string; approved: boolean; riskScore: number }> =
    claudeRes.status === "fulfilled" ? (claudeRes.value.risks ?? []) : [];

  const indList = indicators.status === "fulfilled" ? indicators.value : [];
  const indMap = Object.fromEntries(indList.map((i) => [i.symbol, i]));

  // Consensus-Input pro Symbol aus echten Daten aufbauen
  const inputs = SYMBOLS.map((symbol) => {
    const gpt    = gptAnalyses.find((a) => a.symbol === symbol);
    const claude = claudeRisks.find((r) => r.symbol === symbol);
    const ind    = indMap[symbol];

    const gptBias       = gpt?.direction === "BUY"  ? "BULLISH"
                        : gpt?.direction === "SELL" ? "BEARISH"
                        : ind?.trend === "BULLISH"  ? "BULLISH"
                        : ind?.trend === "BEARISH"  ? "BEARISH"
                        : "NEUTRAL";

    const gptConfidence = gpt?.confidence ?? 70;

    const claudeApproved = claude != null ? claude.approved : true;
    const riskScore      = claude?.riskScore ?? 40;
    const claudeRisk     = riskScore < 35 ? "LOW" : riskScore < 60 ? "MEDIUM" : "HIGH";

    // Python-Trend als Markt-Regime nutzen
    const regimeTrend = ind?.trend === "BULLISH" ? "TRENDING_BULL"
                      : ind?.trend === "BEARISH" ? "TRENDING_BEAR"
                      : "RANGING";

    return {
      symbol,
      marketDataReady: ind != null,
      regimeTrend,
      gptBias,
      gptConfidence,
      claudeApproved,
      claudeRisk,
    };
  });

  const decisions = consensusManager.decideMany(inputs);

  return NextResponse.json({
    success: true,
    decisions,
    sources: {
      gpt:    gptRes.status === "fulfilled" ? gptRes.value.source : "UNAVAILABLE",
      claude: claudeRes.status === "fulfilled" ? claudeRes.value.source : "UNAVAILABLE",
      python: indList.length > 0 ? "LIVE" : "OFFLINE",
    },
    count: decisions.length,
    updatedAt: new Date().toISOString(),
  });
}
