import { PaperDirection } from "@/lib/paper-trading/paper-types";

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
  reason: string;
};

export class GPTAnalyst {
  static generateTradeIdea(
    adaptiveConfidence?: number
  ): GPTTradeIdea {
    const baseConfidence = 82;

    const confidence =
      typeof adaptiveConfidence === "number" &&
      Number.isFinite(adaptiveConfidence)
        ? Math.min(95, Math.max(60, adaptiveConfidence))
        : baseConfidence;

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
      adaptiveConfidenceApplied: confidence !== baseConfidence,
      reason:
        confidence !== baseConfidence
          ? `Adaptive GPT trade idea for V10.3.6: confidence adjusted from ${baseConfidence} to ${confidence} based on AI Learning Engine.`
          : "Mock GPT trade idea for V10.3.6: EURUSD long based on structured demo momentum setup.",
    };
  }
}