import type { LearningCycle } from "./scheduler-types";

export function getWeeklyScheduler(): LearningCycle {
  return {
    period: "WEEKLY",

    tasks: [
      {
        id: "strategy",
        name: "Strategy Evolution",
        enabled: true,
      },
      {
        id: "memory",
        name: "Memory Review",
        enabled: true,
      },
      {
        id: "consensus",
        name: "Consensus Validation",
        enabled: true,
      },
    ],
  };
}