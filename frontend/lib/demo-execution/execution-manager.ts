import { executeDemoOrders } from "./execution-engine";

export function getExecutionStatus() {
  return {
    mode: "Paper Trading",
    liveTrading: false,
    brokerConnected: false,
    status: "READY",
  };
}

export function getExecutionResults() {
  return executeDemoOrders();
}

export function getExecutionRoadmap() {
  return {
    currentPhase: "Demo Execution",

    nextSteps: [
      "Performance Tracking",
      "Learning Feedback",
      "Adaptive Confidence",
      "AI Reports",
      "Controlled Live Trading",
    ],
  };
}