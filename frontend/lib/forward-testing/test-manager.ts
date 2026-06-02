import { generateMockForwardTests } from "./test-planner";

export async function getForwardTestingStatus() {
  return {
    status: "PREPARED",
    message:
      "Forward Testing Engine prepared for future AI planning and learning.",
  };
}

export async function getForwardTestPlans() {
  return generateMockForwardTests();
}

export function getForwardLearningRoadmap() {
  return {
    currentPhase: "Forward Testing Preparation",

    futureGoals: [
      "AI trade planning",
      "Demo trade execution",
      "Result analysis",
      "Strategy ranking",
      "AI memory updates",
      "Strategy evolution",
    ],
  };
}