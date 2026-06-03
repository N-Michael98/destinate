import { detectBias } from "./bias-detector";
import { buildEntryZone } from "./entry-planner";
import { buildTargets } from "./risk-reward-planner";
import { buildReasoning } from "./reasoning-builder";

export class GPTAnalystManager {
  createTradeIdea(
    symbol: string,
    price: number,
    trend: string,
    volatility: string,
    risk: string
  ) {
    const bias =
      detectBias(trend, risk);

    const entry =
      buildEntryZone(price);

    const targets =
      buildTargets(
        price,
        bias
      );

    return {
      symbol,

      bias,

      ...entry,

      ...targets,

      confidence: 80,

      reasoning:
        buildReasoning(
          trend,
          volatility,
          risk
        ),

      createdAt:
        new Date().toISOString(),
    };
  }
}