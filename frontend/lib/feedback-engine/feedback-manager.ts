import { generateTradeFeedback } from "./trade-feedback";
import { generateStrategyFeedback } from "./strategy-feedback";
import { generateConfidenceUpdates } from "./confidence-feedback";

export function getFeedbackStatus() {
  return {
    status: "READY",
    learningLoop: true,
    memoryUpdate: true,
  };
}

export function getTradeFeedbackResults() {
  return generateTradeFeedback();
}

export function getStrategyFeedbackResults() {
  return generateStrategyFeedback();
}

export function getConfidenceUpdates() {
  return generateConfidenceUpdates();
}

export function getFeedbackRoadmap() {
  return {
    currentPhase: "Feedback Engine",

    nextSteps: [
      "Adaptive Confidence",
      "Learning Reports",
      "Autonomous Improvement",
      "Controlled Live Trading",
    ],
  };
}