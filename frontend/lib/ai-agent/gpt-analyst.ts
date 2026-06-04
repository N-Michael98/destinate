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
  reason: string;
};

export class GPTAnalyst {
  static generateTradeIdea(): GPTTradeIdea {
    return {
      source: "GPT_ANALYST",
      symbol: "EURUSD",
      direction: "LONG" as PaperDirection,
      entry: 1.085,
      stopLoss: 1.08,
      takeProfit1: 1.09,
      takeProfit2: 1.095,
      confidence: 82,
      reason:
        "Mock GPT trade idea for V10.3.0: EURUSD long based on structured demo momentum setup.",
    };
  }
}