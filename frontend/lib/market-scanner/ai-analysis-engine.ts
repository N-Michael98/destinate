// Real GPT + Claude analysis engine — uses stored API keys when available
import { getAISettings } from "../ai-config/ai-config-store";
import type { CapitalMarket } from "../capital-com/capital-com-client";

export interface GPTMarketAnalysis {
  symbol: string;
  epic: string;
  direction: "BUY" | "SELL" | "WAIT";
  confidence: number;
  reasoning: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  tradingStyle: "SCALPING" | "DAYTRADING" | "SWING";
  marketBias: string;
  source: "GPT_REAL" | "GPT_SIMULATED";
}

export interface ClaudeRiskAssessment {
  symbol: string;
  approved: boolean;
  riskScore: number;
  maxRiskPercent: number;
  reasoning: string;
  rewardRiskRatio: number;
  source: "CLAUDE_REAL" | "CLAUDE_SIMULATED";
}

export interface ScannerOpportunity {
  rank: number;
  epic: string;
  symbol: string;
  instrumentName: string;
  bid: number;
  ask: number;
  spread: number;
  gpt: GPTMarketAnalysis;
  claude: ClaudeRiskAssessment;
  finalScore: number;
  goSignal: boolean;
}

// Real OpenAI API call
async function callGPT(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }>;
    return choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// Real Anthropic API call
async function callClaude(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const content = data.content as Array<{ text: string }>;
    return content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    // Extract JSON from potential markdown code blocks
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Simulated GPT analysis when no real key available
function simulateGPT(market: CapitalMarket): GPTMarketAnalysis {
  const seed = market.epic.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const conf = 55 + (seed % 35);
  const dir = seed % 3 === 0 ? "WAIT" : seed % 2 === 0 ? "BUY" : "SELL";
  const styles: GPTMarketAnalysis["tradingStyle"][] = ["SCALPING", "DAYTRADING", "SWING"];
  return {
    symbol: market.symbol, epic: market.epic,
    direction: dir as GPTMarketAnalysis["direction"],
    confidence: conf,
    reasoning: `Simulated analysis for ${market.instrumentName}. Connect OpenAI API for real analysis.`,
    entry: market.ask,
    stopLoss: dir === "BUY" ? market.bid * 0.995 : market.ask * 1.005,
    takeProfit: dir === "BUY" ? market.ask * 1.015 : market.bid * 0.985,
    tradingStyle: styles[seed % 3],
    marketBias: seed % 2 === 0 ? "RISK_ON" : "RISK_OFF",
    source: "GPT_SIMULATED",
  };
}

function simulateClaude(gpt: GPTMarketAnalysis): ClaudeRiskAssessment {
  const rrRatio = gpt.direction !== "WAIT"
    ? Math.abs(gpt.takeProfit - gpt.entry) / Math.abs(gpt.entry - gpt.stopLoss)
    : 0;
  const riskScore = Math.max(10, 80 - gpt.confidence);
  return {
    symbol: gpt.symbol,
    approved: gpt.direction !== "WAIT" && gpt.confidence >= 60 && rrRatio >= 1.5,
    riskScore,
    maxRiskPercent: riskScore > 60 ? 0.5 : 1.0,
    reasoning: `Simulated risk assessment. Connect Anthropic API for real analysis. R/R: ${rrRatio.toFixed(2)}`,
    rewardRiskRatio: rrRatio,
    source: "CLAUDE_SIMULATED",
  };
}

export async function analyzeMarkets(markets: CapitalMarket[]): Promise<ScannerOpportunity[]> {
  const ai = await getAISettings();
  const hasGPT = ai.openai.connected && ai.openai.apiKey.length > 20;
  const hasClaude = ai.anthropic.connected && ai.anthropic.apiKey.length > 20;

  // Build market data summary for GPT prompt
  const marketList = markets
    .filter((m) => m.bid > 0)
    .slice(0, 30) // max 30 markets per call to keep tokens manageable
    .map((m) => `${m.epic} (${m.instrumentName}): bid=${m.bid} ask=${m.ask} spread=${m.spread}`)
    .join("\n");

  let gptBatchResult: Record<string, Partial<GPTMarketAnalysis>> = {};

  if (hasGPT && marketList) {
    const prompt = `You are a professional forex and CFD trading analyst with 20 years of experience.

Analyze these live markets from Capital.com DEMO and identify the TOP 5 trading opportunities:

${marketList}

Return ONLY valid JSON with this structure:
{
  "opportunities": [
    {
      "epic": "GOLD",
      "symbol": "XAUUSD",
      "direction": "BUY",
      "confidence": 75,
      "reasoning": "Brief technical/fundamental reason",
      "entry": 2340.5,
      "stopLoss": 2320.0,
      "takeProfit": 2380.0,
      "tradingStyle": "DAYTRADING",
      "marketBias": "RISK_OFF"
    }
  ],
  "marketOverview": "Brief market overview"
}

Rules:
- direction must be BUY, SELL, or WAIT
- confidence: 0-100
- tradingStyle: SCALPING (minutes), DAYTRADING (hours), or SWING (days)
- Only recommend trades with realistic entry/stop/TP based on current bid/ask
- stopLoss and takeProfit must be logical (stop BELOW entry for BUY, ABOVE for SELL)`;

    const raw = await callGPT(ai.openai.apiKey, ai.openai.model, prompt);
    const parsed = parseJSON<{ opportunities: Array<Partial<GPTMarketAnalysis>> }>(raw, { opportunities: [] });
    for (const opp of parsed.opportunities ?? []) {
      if (opp.epic) gptBatchResult[opp.epic] = opp;
    }
  }

  // Analyze each market
  const opportunities: ScannerOpportunity[] = [];

  for (const market of markets.filter((m) => m.bid > 0)) {
    // GPT analysis
    let gpt: GPTMarketAnalysis;
    const gptData = gptBatchResult[market.epic];
    if (hasGPT && gptData?.direction) {
      gpt = {
        symbol: market.symbol,
        epic: market.epic,
        direction: (gptData.direction ?? "WAIT") as GPTMarketAnalysis["direction"],
        confidence: gptData.confidence ?? 60,
        reasoning: gptData.reasoning ?? "",
        entry: gptData.entry ?? market.ask,
        stopLoss: gptData.stopLoss ?? market.bid * 0.995,
        takeProfit: gptData.takeProfit ?? market.ask * 1.01,
        tradingStyle: (gptData.tradingStyle ?? "DAYTRADING") as GPTMarketAnalysis["tradingStyle"],
        marketBias: gptData.marketBias ?? "NEUTRAL",
        source: "GPT_REAL",
      };
    } else {
      gpt = simulateGPT(market);
    }

    // Claude risk assessment
    let claude: ClaudeRiskAssessment;
    if (hasClaude && gpt.direction !== "WAIT") {
      const rrRatio = Math.abs(gpt.takeProfit - gpt.entry) / Math.abs(gpt.entry - gpt.stopLoss);
      const prompt = `You are a professional risk manager for a forex/CFD trading firm.

Assess the risk for this trade setup:
- Instrument: ${market.instrumentName} (${market.epic})
- Direction: ${gpt.direction}
- Current bid/ask: ${market.bid} / ${market.ask}
- Entry: ${gpt.entry}
- Stop Loss: ${gpt.stopLoss}
- Take Profit: ${gpt.takeProfit}
- GPT Confidence: ${gpt.confidence}%
- Reward/Risk Ratio: ${rrRatio.toFixed(2)}
- Trading Style: ${gpt.tradingStyle}

Return ONLY valid JSON:
{
  "approved": true,
  "riskScore": 35,
  "maxRiskPercent": 1.0,
  "reasoning": "Brief risk assessment",
  "rewardRiskRatio": ${rrRatio.toFixed(2)}
}

Rules:
- approved: true only if riskScore < 60 AND rewardRiskRatio >= 1.5
- riskScore: 0-100 (lower is safer)
- maxRiskPercent: 0.5-2.0`;

      const raw = await callClaude(ai.anthropic.apiKey, ai.anthropic.model, prompt);
      const parsed = parseJSON<Partial<ClaudeRiskAssessment>>(raw, {});
      const riskScore = parsed.riskScore ?? 50;
      const parsedRR = parsed.rewardRiskRatio ?? rrRatio;
      // Always derive approved from numeric metrics — Claude's text boolean is unreliable
      const approved = riskScore < 65 && parsedRR >= 1.5;
      claude = {
        symbol: market.symbol,
        approved,
        riskScore,
        maxRiskPercent: parsed.maxRiskPercent ?? 1.0,
        reasoning: parsed.reasoning ?? "",
        rewardRiskRatio: parsedRR,
        source: "CLAUDE_REAL",
      };
    } else {
      claude = simulateClaude(gpt);
    }

    const finalScore = gpt.direction === "WAIT" ? 0 :
      (gpt.confidence * 0.5 + (100 - claude.riskScore) * 0.3 + (claude.approved ? 20 : 0));

    opportunities.push({
      rank: 0,
      epic: market.epic,
      symbol: market.symbol,
      instrumentName: market.instrumentName,
      bid: market.bid,
      ask: market.ask,
      spread: market.spread,
      gpt,
      claude,
      finalScore,
      goSignal: claude.approved && gpt.confidence >= 65 && gpt.direction !== "WAIT",
    });
  }

  return opportunities
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((o, i) => ({ ...o, rank: i + 1 }));
}
