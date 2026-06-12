import { calculateConfidence } from "./confidence-engine";
import type { StrategyEvolutionScore } from "./evolution-types";
import { getLearningAdjustmentFactor } from "@/lib/learning/trade-feedback-engine";

// Jede Evolution-Strategie ist einer Python-Backtest-Strategie + Symbol zugeordnet
const STRATEGY_DEFINITIONS = [
  { strategy: "Risk-Off Trend",      symbol: "XAUUSD", interval: "1h", period: "3mo", backtest_strategy: "multi" },
  { strategy: "Momentum Breakout",   symbol: "EURUSD", interval: "1h", period: "3mo", backtest_strategy: "macd"  },
  { strategy: "Inventory Reaction",  symbol: "NAS100", interval: "1h", period: "3mo", backtest_strategy: "ema"   },
];

const FALLBACK: Record<string, { winRate: number; averageReturn: number }> = {
  "Risk-Off Trend":    { winRate: 74, averageReturn: 2.4 },
  "Momentum Breakout": { winRate: 68, averageReturn: 1.8 },
  "Inventory Reaction":{ winRate: 61, averageReturn: 1.4 },
};

export function generateMockEvolutionScores(): StrategyEvolutionScore[] {
  return STRATEGY_DEFINITIONS.map(({ strategy }) => {
    const fb = FALLBACK[strategy];
    const confidence = calculateConfidence(fb.winRate, fb.averageReturn);
    return { strategy, winRate: fb.winRate, averageReturn: fb.averageReturn, confidence, evolutionScore: confidence + fb.averageReturn * 5 };
  });
}

export async function generateLiveEvolutionScores(): Promise<StrategyEvolutionScore[]> {
  const PYTHON_BASE = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";
  const results: StrategyEvolutionScore[] = [];

  for (const def of STRATEGY_DEFINITIONS) {
    try {
      const res = await fetch(`${PYTHON_BASE}/api/v1/backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol:   def.symbol,
          interval: def.interval,
          period:   def.period,
          strategy: def.backtest_strategy,
          initial_balance: 10000,
        }),
        cache: "no-store",
      });

      if (res.ok) {
        const d = await res.json();
        const winRate    = d.win_rate ?? FALLBACK[def.strategy].winRate;
        const avgReturn  = d.total_return_pct
          ? Math.abs(d.total_return_pct) / Math.max(d.total_trades ?? 1, 1)
          : FALLBACK[def.strategy].averageReturn;
        const confidence = calculateConfidence(winRate, avgReturn);
        const pfBoost      = Math.min((d.profit_factor ?? 1) * 0.5, 5);
        const sharpeBoost  = Math.min((d.sharpe_ratio ?? 0) * 2, 4);
        // Echter Lern-Faktor aus Paper-Trade-History
        const learningFactor = getLearningAdjustmentFactor(def.strategy);
        const baseScore = confidence + avgReturn * 5 + pfBoost + sharpeBoost;
        results.push({
          strategy:      def.strategy,
          winRate:       Math.round(winRate * 10) / 10,
          averageReturn: Math.round(avgReturn * 100) / 100,
          confidence,
          evolutionScore: Math.round(baseScore * learningFactor * 10) / 10,
        });
        continue;
      }
    } catch { /* use fallback */ }

    const fb = FALLBACK[def.strategy];
    const confidence = calculateConfidence(fb.winRate, fb.averageReturn);
    results.push({ strategy: def.strategy, ...fb, confidence, evolutionScore: confidence + fb.averageReturn * 5 });
  }

  return results;
}
