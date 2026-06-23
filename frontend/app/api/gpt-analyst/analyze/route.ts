import { NextResponse } from "next/server";
import { getAISettings } from "../../../../lib/ai-config/ai-config-store";
import { GPTAnalystManager } from "@/lib/gpt-analyst-engine";
import {
  fetchIndicatorsMany,
  fetchBacktest,
  formatIndicatorsForPrompt,
  formatBacktestForPrompt,
} from "@/lib/python-bridge/python-data";

// Base universe — extended to match market scanner
const BASE_SYMBOLS = ["XAUUSD", "EURUSD", "BTCUSD", "NAS100", "USOIL", "GBPUSD", "SPX500", "SILVER"];

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ai = await getAISettings();

  // Allow caller to override symbols (e.g. from market scanner results)
  const { searchParams } = new URL(request.url);
  const symbolParam = searchParams.get("symbols");
  const SYMBOLS = symbolParam ? symbolParam.split(",").map(s => s.trim()).filter(Boolean) : BASE_SYMBOLS;

  // Echte Marktdaten + Indikatoren von Python holen
  const [indicators, btXAU, btEUR] = await Promise.all([
    fetchIndicatorsMany(SYMBOLS, "1h", "1mo"),
    fetchBacktest("XAUUSD", "1h", "6mo"),
    fetchBacktest("EURUSD", "1h", "6mo"),
  ]);

  const hasPythonData = indicators.length > 0;

  // Marktkontext für Prompt aufbauen
  const marketContext = hasPythonData
    ? indicators.map(formatIndicatorsForPrompt).join("\n\n")
    : "Live market data unavailable — use general market knowledge.";

  const backtestContext = [
    btXAU ? formatBacktestForPrompt(btXAU) : null,
    btEUR ? formatBacktestForPrompt(btEUR) : null,
  ].filter(Boolean).join("\n");

  if (ai.openai.connected && ai.openai.apiKey.length > 20) {
    try {
      const prompt = `You are a professional CFD/forex trading analyst with access to live market data.

LIVE MARKET DATA (from Python/yfinance — use these exact values):
${marketContext}

${backtestContext ? `BACKTESTING RESULTS (last 6 months):\n${backtestContext}\n` : ""}

Based on this REAL data, analyze the markets and return trade ideas as a JSON array.
For each symbol consider: RSI overbought/oversold, MACD momentum, trend direction (EMA alignment), ATR for stop sizing.

Analyze ALL ${SYMBOLS.length} symbols: ${SYMBOLS.join(", ")}.
Return a JSON array with one entry per symbol:
[
  {
    "symbol": "XAUUSD",
    "direction": "BUY or SELL",
    "confidence": 60-95,
    "reasoning": "brief reason based on the indicators above",
    "entry": <use current price from data>,
    "stopLoss": <entry ± ATR*1.5>,
    "takeProfit": <entry ± ATR*3>,
    "tradingStyle": "DAYTRADING or SWING or SCALPING"
  },
  ...
]`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${ai.openai.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ai.openai.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        const choices = data.choices as Array<{ message: { content: string } }>;
        const raw = choices?.[0]?.message?.content ?? "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        const analyses = match ? JSON.parse(match[0]) : [];
        return NextResponse.json({
          success: true,
          analyses,
          source: "GPT_REAL",
          pythonData: hasPythonData,
          model: ai.openai.model,
          count: analyses.length,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch { /* fallthrough */ }
  }

  // Fallback mit echten Preisen wenn verfügbar
  const analyst = new GPTAnalystManager();
  const indMap = Object.fromEntries(indicators.map((i) => [i.symbol, i]));

  const analyses = SYMBOLS.map((sym) => {
    const ind = indMap[sym];
    const price = ind?.price ?? (sym === "XAUUSD" ? 2340 : sym === "EURUSD" ? 1.085 : sym === "BTCUSD" ? 67500 : 19000);
    const regime = ind?.trend === "BULLISH" ? "TRENDING_BULL" : ind?.trend === "BEARISH" ? "TRENDING_BEAR" : "RANGING";
    return analyst.createTradeIdea(sym, price, regime, "NORMAL", "NEUTRAL");
  });

  return NextResponse.json({
    success: true,
    analyses,
    source: "GPT_ANALYST_LIVE",
    pythonData: hasPythonData,
    count: analyses.length,
    updatedAt: new Date().toISOString(),
  });
}
