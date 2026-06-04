import { PaperDirection } from "@/lib/paper-trading/paper-types";

export type GPTStrategyContext = {
  id: string;
  name: string;
  type: string;
  score: number;
  confidenceBoost: number;
  status: string;
};

export type GPTTradeIdea = {
  source: "GPT_ANALYST";
  symbol: string;
  direction: PaperDirection;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidence: number;
  baseConfidence: number;
  adaptiveConfidenceApplied: boolean;
  strategy?: GPTStrategyContext;
  strategyApplied: boolean;
  reason: string;
};

export class GPTAnalyst {
  static generateTradeIdea(
    adaptiveConfidence?: number,
    strategy?: GPTStrategyContext
  ): GPTTradeIdea {
    const baseConfidence = 82;

    const adaptiveBaseConfidence =
      typeof adaptiveConfidence === "number" &&
      Number.isFinite(adaptiveConfidence)
        ? Math.min(95, Math.max(60, adaptiveConfidence))
        : baseConfidence;

    const strategyBoost =
      strategy?.confidenceBoost ?? 0;

    const confidence = Math.min(
      95,
      Math.max(
        60,
        adaptiveBaseConfidence + strategyBoost
      )
    );

    const strategyApplied = !!strategy;

    return {
      source: "GPT_ANALYST",
      symbol: "EURUSD",
      direction: "LONG" as PaperDirection,
      entry: 1.085,
      stopLoss: 1.08,
      takeProfit1: 1.09,
      takeProfit2: 1.095,
      confidence,
      baseConfidence,
      adaptiveConfidenceApplied:
        confidence !== baseConfidence,
      strategy,
      strategyApplied,
      reason: strategyApplied
        ? `Strategy-selected GPT trade idea for V10.4.2: ${strategy.name} selected with score ${strategy.score}. Confidence adjusted from ${baseConfidence} to ${confidence}.`
        : confidence !== baseConfidence
          ? `Adaptive GPT trade idea for V10.4.2: confidence adjusted from ${baseConfidence} to ${confidence} based on AI Learning Engine.`
          : "Mock GPT trade idea for V10.4.2: EURUSD long based on structured demo momentum setup.",
    };
  }
}