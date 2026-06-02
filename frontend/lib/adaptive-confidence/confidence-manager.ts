import { getAdaptiveConfidenceScore } from "./confidence-engine";
import { getConfidenceAdjustments } from "./confidence-adjuster";
import { getConfidenceHistory } from "./confidence-history";

export function getConfidenceStatus() {
  return {
    status: "READY",
    adaptiveLearning: true,
    riskFilter: true,
  };
}

export function getConfidenceScore() {
  return getAdaptiveConfidenceScore();
}

export function getConfidenceUpdates() {
  return getConfidenceAdjustments();
}

export function getConfidenceHistoryData() {
  return getConfidenceHistory();
}

export function getConfidenceRoadmap() {
  return {
    currentPhase: "Adaptive Confidence",

    nextSteps: [
      "Learning Reports",
      "AI Improvement",
      "Adaptive Position Sizing",
      "Controlled Live Trading",
    ],
  };
}