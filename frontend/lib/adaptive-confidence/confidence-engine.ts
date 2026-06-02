import { getConfidenceAdjustments } from "./confidence-adjuster";

export function getTopConfidenceStrategy() {
  const strategies = getConfidenceAdjustments();

  return strategies.sort(
    (a, b) => b.newConfidence - a.newConfidence
  )[0];
}

export function getAdaptiveConfidenceScore() {
  return 83;
}