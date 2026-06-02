import { getPerformanceSummary } from "./equity-performance";
import { getBestStrategy } from "./strategy-performance";
import { getMockTradeResults } from "./trade-performance";

export function getTrackerStatus() {
  return {
    status: "READY",
    mode: "Performance Tracking",
    learningEnabled: true,
  };
}

export function getTradePerformance() {
  return getMockTradeResults();
}

export function getPerformanceMetrics() {
  return getPerformanceSummary();
}

export function getTopStrategy() {
  return getBestStrategy();
}

export function getPerformanceRoadmap() {
  return {
    currentPhase: "Performance Tracker",

    nextSteps: [
      "Feedback Engine",
      "Adaptive Confidence",
      "Learning Reports",
      "Autonomous Improvement Loop",
    ],
  };
}