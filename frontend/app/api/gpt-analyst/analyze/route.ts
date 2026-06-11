import { NextResponse } from "next/server";
import { getAISettings } from "../../../../lib/ai-config/ai-config-store";
import { GPTAnalystManager } from "@/lib/gpt-analyst-engine";

export async function GET() {
  const ai = getAISettings();

  // Use real OpenAI API if key is stored
  if (ai.openai.connected && ai.openai.apiKey.length > 20) {
    try {
      const prompt = `You are a professional CFD/forex trading analyst.
Analyze these 4 markets and return trade ideas in JSON:
- XAUUSD (Gold): current price ~2340
- USOIL (Crude Oil): current price ~78.5
- EURUSD: current price ~1.085
- BTCUSD (Bitcoin): current price ~67500

Return JSON array:
[
  { "symbol": "XAUUSD", "direction": "BUY", "confidence": 72, "reasoning": "...", "entry": 2340.5, "stopLoss": 2320.0, "takeProfit": 2380.0, "tradingStyle": "DAYTRADING" },
  ...
]`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${ai.openai.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ai.openai.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        const choices = data.choices as Array<{ message: { content: string } }>;
        const raw = choices?.[0]?.message?.content ?? "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        const analyses = match ? JSON.parse(match[0]) : [];
        return NextResponse.json({ success: true, analyses, source: "GPT_REAL", model: ai.openai.model, count: analyses.length, updatedAt: new Date().toISOString() });
      }
    } catch { /* fallthrough to simulation */ }
  }

  // Fallback: simulation
  const analyst = new GPTAnalystManager();
  const analyses = [
    analyst.createTradeIdea("XAUUSD", 2340, "TRENDING_BULL", "NORMAL", "RISK_OFF"),
    analyst.createTradeIdea("USOIL", 78.4, "TRENDING_BEAR", "NORMAL", "NEUTRAL"),
    analyst.createTradeIdea("EURUSD", 1.085, "TRENDING_BEAR", "NORMAL", "NEUTRAL"),
    analyst.createTradeIdea("BTCUSD", 67500, "TRENDING_BULL", "VOLATILE", "RISK_ON"),
  ];
  return NextResponse.json({ success: true, analyses, source: "SIMULATED", count: analyses.length, updatedAt: new Date().toISOString() });
}
