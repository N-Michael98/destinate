import { getMockTradeResults } from "./trade-performance";

export function getBestStrategy() {
  const results = getMockTradeResults();

  return results.reduce((best, current) =>
    current.resultR > best.resultR
      ? current
      : best
  );
}