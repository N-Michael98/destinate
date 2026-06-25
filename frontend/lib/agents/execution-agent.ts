/**
 * ExecutionAgent — zuständig für Trade-Ausführung auf allen Brokern
 *
 * Eigener Claude AI Manager prüft vor jeder Ausführung:
 * - Ist das Signal noch valide? (Staleness-Check)
 * - Ist das Risiko im Rahmen?
 * - Soll Capital.com, IC Markets oder beide ausführen?
 *
 * Kommuniziert via Agent Bus.
 */

import Anthropic from "@anthropic-ai/sdk";
import { agentBus } from "./agent-bus";
import { executeCapitalDemoOrder, type ExecutionRequest, type ExecutionResult } from "../capital-com/capital-com-execution";

const AGENT_ID = "ExecutionAgent";

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface ExecutionAgentRequest extends ExecutionRequest {
  signalGeneratedAt?: string;  // ISO — für Staleness-Check
  skipAIValidation?: boolean;  // Notfall-Override
}

export interface ExecutionAgentResult {
  ok: boolean;
  capital?: ExecutionResult;
  icMarkets?: { ok: boolean; positionId?: string; error?: string };
  skippedByAI: boolean;
  aiReason: string;
  executedAt: string;
}

// ── AI Manager ────────────────────────────────────────────────────────────────

let aiClient: Anthropic | null = null;

function getAI(): Anthropic {
  if (!aiClient) aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return aiClient;
}

interface AIExecutionDecision {
  approve: boolean;
  brokers: ("CAPITAL" | "IC_MARKETS")[];
  reason: string;
  adjustedRiskPercent?: number;
}

async function askAIManager(req: ExecutionAgentRequest): Promise<AIExecutionDecision> {
  try {
    const signalAge = req.signalGeneratedAt
      ? Math.round((Date.now() - new Date(req.signalGeneratedAt).getTime()) / 1000)
      : 0;

    const ai = getAI();
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `ExecutionAgent Validierung:
Symbol: ${req.symbol} ${req.direction}
Style: ${req.tradingStyle}
Confidence: ${req.confidence}%
Risk: ${req.riskPercent}%
Signal-Alter: ${signalAge}s

Prüfe:
1. Signal-Alter > 300s → ABLEHNEN (Signal zu alt)
2. Confidence < 70 → ABLEHNEN
3. Risk > 2% → Risk reduzieren auf 1.5%

Antworte NUR mit JSON:
{"approve":true,"brokers":["CAPITAL","IC_MARKETS"],"reason":"kurz","adjustedRiskPercent":${req.riskPercent}}`
      }]
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (json) return JSON.parse(json) as AIExecutionDecision;
  } catch (err) {
    console.warn(`[exec-agent] AI Manager Fehler — Fallback approve (${err})`);
  }
  // Fallback: beide Broker, kein Risiko-Override
  return { approve: true, brokers: ["CAPITAL", "IC_MARKETS"], reason: "fallback" };
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

export async function runExecutionAgent(req: ExecutionAgentRequest): Promise<ExecutionAgentResult> {
  console.log(`[exec-agent] ${req.symbol} ${req.direction} confidence=${req.confidence}%`);

  // ── AI Validierung ─────────────────────────────────────────────────────────
  let aiDecision: AIExecutionDecision = { approve: true, brokers: ["CAPITAL", "IC_MARKETS"], reason: "skip-validation" };

  if (!req.skipAIValidation) {
    aiDecision = await askAIManager(req);
  }

  if (!aiDecision.approve) {
    console.log(`[exec-agent] ❌ AI hat abgelehnt: ${aiDecision.reason}`);
    agentBus.publish({
      type: "EXECUTION:TRADE_CLOSED",
      agentId: AGENT_ID,
      timestamp: new Date().toISOString(),
      payload: { symbol: req.symbol, direction: req.direction, reason: "AI_REJECTED", aiReason: aiDecision.reason },
    });
    return {
      ok: false,
      skippedByAI: true,
      aiReason: aiDecision.reason,
      executedAt: new Date().toISOString(),
    };
  }

  // Risiko-Anpassung durch AI
  const effectiveReq: ExecutionRequest = {
    ...req,
    riskPercent: aiDecision.adjustedRiskPercent ?? req.riskPercent,
  };

  const useCapital = aiDecision.brokers.includes("CAPITAL");
  const useIC = aiDecision.brokers.includes("IC_MARKETS");

  // ── Parallel-Execution auf beiden Brokern ──────────────────────────────────
  const [capitalResult, icResult] = await Promise.all([
    useCapital ? executeCapitalDemoOrder(effectiveReq) : Promise.resolve(null),
    useIC ? executeICMarketsOrder(effectiveReq) : Promise.resolve(null),
  ]);

  const ok = (capitalResult?.ok ?? false) || (icResult?.ok ?? false);

  if (ok) {
    agentBus.publish({
      type: "EXECUTION:TRADE_OPENED",
      agentId: AGENT_ID,
      timestamp: new Date().toISOString(),
      payload: {
        symbol: req.symbol,
        direction: req.direction,
        confidence: req.confidence,
        tradingStyle: req.tradingStyle,
        capitalDealId: capitalResult?.dealId,
        icPositionId: icResult?.positionId,
        aiReason: aiDecision.reason,
        riskPercent: effectiveReq.riskPercent,
      },
    });
    console.log(`[exec-agent] ✅ ${req.symbol} ${req.direction} — Capital:${capitalResult?.ok ? capitalResult.dealId : "❌"} IC:${icResult?.ok ? icResult.positionId : "❌"}`);
  } else {
    console.warn(`[exec-agent] ❌ Beide Broker fehlgeschlagen: ${req.symbol}`);
  }

  return {
    ok,
    capital: capitalResult ?? undefined,
    icMarkets: icResult ?? undefined,
    skippedByAI: false,
    aiReason: aiDecision.reason,
    executedAt: new Date().toISOString(),
  };
}

// ── IC Markets Wrapper (lazy import um Zirkularität zu vermeiden) ─────────────

async function executeICMarketsOrder(req: ExecutionRequest): Promise<{ ok: boolean; positionId?: string; error?: string } | null> {
  try {
    const { isICMarketsConnected, getICMarketsSession } = await import("../icmarkets/icmarkets-session");
    if (!isICMarketsConnected()) return null;

    const { executeICMarketsOrder: icExecute } = await import("../icmarkets/icmarkets-execution");
    const icSession = getICMarketsSession();
    return await icExecute({
      ...req,
      accountBalance: icSession?.balance ?? req.accountBalance,
    });
  } catch (err) {
    console.warn(`[exec-agent] IC Markets Fehler: ${err}`);
    return { ok: false, error: String(err) };
  }
}
