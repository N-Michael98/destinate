import { NextResponse } from "next/server";
import { getAISettings } from "../../../../lib/ai-config/ai-config-store";
import { ClaudeRiskManager } from "@/lib/claude-risk-engine";

export async function GET() {
  const ai = getAISettings();

  // Use real Anthropic API if key is stored
  if (ai.anthropic.connected && ai.anthropic.apiKey.length > 20) {
    try {
      const prompt = `You are a professional risk manager for a CFD trading firm.
Assess risk for these 4 trades and return a JSON array:
- XAUUSD BUY: entry 2340.5, stop 2320, target 2380, confidence 72%
- USOIL SELL: entry 78.5, stop 80, target 75, confidence 65%
- EURUSD SELL: entry 1.085, stop 1.090, target 1.075, confidence 68%
- BTCUSD BUY: entry 67500, stop 65000, target 72000, confidence 70%

Return JSON array:
[
  { "symbol": "XAUUSD", "approved": true, "riskScore": 35, "maxRiskPercent": 1.0, "reasoning": "...", "rewardRiskRatio": 2.0 },
  ...
]`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ai.anthropic.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: ai.anthropic.model, max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
      });

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        const content = data.content as Array<{ text: string }>;
        const raw = content?.[0]?.text ?? "[]";
        const match = raw.match(/\[[\s\S]*\]/);
        const risks = match ? JSON.parse(match[0]) : [];
        return NextResponse.json({ success: true, risks, source: "CLAUDE_REAL", model: ai.anthropic.model, count: risks.length, updatedAt: new Date().toISOString() });
      }
    } catch { /* fallthrough to simulation */ }
  }

  // Fallback: simulation
  const manager = new ClaudeRiskManager();
  const risks = [
    manager.assess("XAUUSD", 3, 25, 1, "NORMAL"),
    manager.assess("USOIL", 6, 35, 2, "NORMAL"),
    manager.assess("EURUSD", 4, 20, 1, "NORMAL"),
    manager.assess("BTCUSD", 8, 50, 3, "VOLATILE"),
  ];
  return NextResponse.json({ success: true, risks, source: "SIMULATED", count: risks.length, updatedAt: new Date().toISOString() });
}
