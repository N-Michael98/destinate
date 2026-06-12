import { NextResponse } from "next/server";
import { getAISettings } from "../../../../lib/ai-config/ai-config-store";
import { ClaudeRiskManager } from "@/lib/claude-risk-engine";
import {
  fetchIndicatorsMany,
  formatIndicatorsForPrompt,
} from "@/lib/python-bridge/python-data";

const SYMBOLS = ["XAUUSD", "EURUSD", "BTCUSD", "NAS100"];

export async function GET() {
  const ai = getAISettings();

  // GPT-Analyse holen (damit Claude echte Trade-Ideen bewertet)
  let gptAnalyses: Array<{
    symbol: string; direction: string; entry: number;
    stopLoss: number; takeProfit: number; confidence: number;
  }> = [];

  try {
    const gptRes = await fetch(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/gpt-analyst/analyze`,
      { cache: "no-store" }
    );
    if (gptRes.ok) {
      const gd = await gptRes.json();
      gptAnalyses = gd.analyses ?? [];
    }
  } catch { /* use fallback */ }

  // Echte Indikatoren von Python
  const indicators = await fetchIndicatorsMany(SYMBOLS, "1h", "1mo");
  const hasPythonData = indicators.length > 0;
  const indMap = Object.fromEntries(indicators.map((i) => [i.symbol, i]));

  // Trade-Specs für Prompt aufbauen
  const tradeSpecs = SYMBOLS.map((sym) => {
    const gpt = gptAnalyses.find((a) => a.symbol === sym);
    const ind = indMap[sym];
    const price = ind?.price ?? gpt?.entry ?? 0;
    const atr = ind?.indicators.atr ?? price * 0.005;
    const dir = gpt?.direction ?? (ind?.trend === "BULLISH" ? "BUY" : "SELL");
    const entry = gpt?.entry ?? price;
    const sl = gpt?.stopLoss ?? (dir === "BUY" ? entry - atr * 1.5 : entry + atr * 1.5);
    const tp = gpt?.takeProfit ?? (dir === "BUY" ? entry + atr * 3 : entry - atr * 3);
    const rr = Math.abs(tp - entry) / Math.abs(entry - sl);
    return { sym, dir, entry: entry.toFixed(5), sl: sl.toFixed(5), tp: tp.toFixed(5), rr: rr.toFixed(2), conf: gpt?.confidence ?? 70, ind };
  });

  if (ai.anthropic.connected && ai.anthropic.apiKey.length > 20) {
    try {
      const tradeSection = tradeSpecs.map((t) => {
        const indText = t.ind ? formatIndicatorsForPrompt(t.ind) : "No indicator data";
        return `${t.sym} ${t.dir}: entry ${t.entry}, stop ${t.sl}, target ${t.tp} (R:R ${t.rr}) — confidence ${t.conf}%\n${indText}`;
      }).join("\n\n");

      const prompt = `You are a professional risk manager for a CFD/forex trading firm.

Assess the risk for these trades. Each trade includes LIVE technical indicators from Python/yfinance.
Use the indicator data to judge risk quality — consider RSI extremes, ATR volatility, trend alignment.

TRADES TO ASSESS:
${tradeSection}

Return a JSON array with one entry per symbol:
[
  {
    "symbol": "XAUUSD",
    "approved": true,
    "riskScore": 35,
    "maxRiskPercent": 1.0,
    "rewardRiskRatio": 2.0,
    "reasoning": "Short explanation referencing the actual indicators"
  },
  ...
]

Rules: riskScore 0-100 (higher = more risky). Approve if riskScore < 60 and R:R > 1.5.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ai.anthropic.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ai.anthropic.model,
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        const content = data.content as Array<{ text: string }>;
        const raw = content?.[0]?.text ?? "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        const risks = match ? JSON.parse(match[0]) : [];
        return NextResponse.json({
          success: true, risks,
          source: "CLAUDE_REAL",
          pythonData: hasPythonData,
          model: ai.anthropic.model,
          count: risks.length,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch { /* fallthrough */ }
  }

  // Fallback mit echten Risiko-Werten aus Python
  const manager = new ClaudeRiskManager();
  const risks = SYMBOLS.map((sym) => {
    const ind = indMap[sym];
    const rsi = ind?.indicators.rsi.value ?? 50;
    const adx = ind?.indicators.adx.adx ?? 20;
    const riskLevel = rsi > 70 || rsi < 30 ? 6 : 3;
    const volatility = adx > 40 ? "VOLATILE" : "NORMAL";
    return manager.assess(sym, riskLevel, 25, 1, volatility);
  });

  return NextResponse.json({
    success: true, risks,
    source: "SIMULATED",
    pythonData: hasPythonData,
    count: risks.length,
    updatedAt: new Date().toISOString(),
  });
}
