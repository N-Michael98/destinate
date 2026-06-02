import type {
  ForwardTestResult,
  StrategyPerformance,
} from "./test-types";

export function buildStrategyPerformance(
  strategy: string,
  results: ForwardTestResult[]
): StrategyPerformance {
  const wins = results.filter(
    (result) => result.profitLossPercent > 0
  ).length;

  const losses = results.length - wins;

  const averageReturn =
    results.length > 0
      ? results.reduce(
          (sum, result) => sum + result.profitLossPercent,
          0
        ) / results.length
      : 0;

  return {
    strategy,
    totalTests: results.length,
    wins,
    losses,
    winRate:
      results.length > 0
        ? (wins / results.length) * 100
        : 0,
    averageReturn,
  };
}