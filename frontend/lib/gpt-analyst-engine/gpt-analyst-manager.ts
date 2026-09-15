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

      // `confidence: 80` ERSATZLOS ENTFALLEN (15.09.) — bedingungslos
      // zurueckgegeben und im Dashboard als „Confidence — Average score"
      // angezeigt, mit Auto-Refresh alle 20 Sekunden. Vollstaendige
      // Begruendung in `claude-risk-engine/claude-risk-manager.ts`; dort stand
      // dieselbe Konstruktion mit 85.
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