import type { ForwardTestResult } from "./test-types";

export function calculateAverageReturn(
  results: ForwardTestResult[]
): number {
  if (results.length === 0) return 0;

  const total = results.reduce(
    (sum, result) => sum + result.profitLossPercent,
    0
  );

  return total / results.length;
}

export function calculateWinRate(
  results: ForwardTestResult[]
): number {
  if (results.length === 0) return 0;

  const wins = results.filter(
    (result) => result.profitLossPercent > 0
  ).length;

  return (wins / results.length) * 100;
}