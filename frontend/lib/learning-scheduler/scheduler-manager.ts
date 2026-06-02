import { getDailyScheduler } from "./daily-scheduler";
import { getWeeklyScheduler } from "./weekly-scheduler";
import { getMonthlyScheduler } from "./monthly-scheduler";
import { getLearningCycleSteps } from "./learning-cycle";

export function getSchedulerStatus() {
  return {
    status: "READY",
    automation: "PREPARED",
  };
}

export function getSchedulerOverview() {
  return {
    daily: getDailyScheduler(),
    weekly: getWeeklyScheduler(),
    monthly: getMonthlyScheduler(),
    cycle: getLearningCycleSteps(),
  };
}