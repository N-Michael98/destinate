import { getAgentReview } from "./agent-review";
import { getClaudeReview } from "./claude-review";
import { getConsensusReview } from "./consensus-review";
import { getDailyReport } from "./daily-report";
import { getGptReview } from "./gpt-review";
import { getMonthlyReport } from "./monthly-report";
import { getWeeklyReport } from "./weekly-report";

export function getLearningReportStatus() {
  return {
    status: "READY",
    multiAiValidation: true,
    reportsEnabled: true,
  };
}

export function getAllAiReviews() {
  return {
    gpt: getGptReview(),
    claude: getClaudeReview(),
    agent: getAgentReview(),
    consensus: getConsensusReview(),
  };
}

export function getAllLearningReports() {
  return {
    daily: getDailyReport(),
    weekly: getWeeklyReport(),
    monthly: getMonthlyReport(),
  };
}

export function getLearningReportRoadmap() {
  return {
    currentPhase: "Multi-AI Learning Reports",

    nextSteps: [
      "Autonomous Improvement Loop",
      "Agent Learning Scheduler",
      "Demo Portfolio Reports",
      "Controlled Live Readiness",
    ],
  };
}