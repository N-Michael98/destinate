import type { LearningCycle } from "./scheduler-types";

export function getDailyScheduler(): LearningCycle {
  return {
    period: "DAILY",

    tasks: [
      {
        id: "performance",
        name: "Performance Review",
        enabled: true,
      },
      {
        id: "feedback",
        name: "Feedback Update",
        enabled: true,
      },
      {
        id: "confidence",
        name: "Confidence Adjustment",
        enabled: true,
      },
    ],
  };
}