import type { LearningCycle } from "./scheduler-types";

export function getMonthlyScheduler(): LearningCycle {
  return {
    period: "MONTHLY",

    tasks: [
      {
        id: "full-review",
        name: "Full AI Review",
        enabled: true,
      },
      {
        id: "ranking",
        name: "Strategy Ranking",
        enabled: true,
      },
      {
        id: "roadmap",
        name: "Learning Roadmap Update",
        enabled: true,
      },
    ],
  };
}