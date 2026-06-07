import type {
  AIExecutionSchedulerReport,
  ExecutionUrgency,
  ScheduledExecutionItem,
  SchedulerInput,
  SchedulerStatus,
} from "./ai-execution-scheduler-types";

const schedulerInputs: SchedulerInput[] = [
  {
    symbol: "XAUUSD",
    primaryStyle: "SCALPING",
    activeDirection: "LONG",
    approvalStatus: "STRICT_APPROVAL_REQUIRED",
    allowExecution: true,
    requireStrictApproval: true,
    priorityScore: 88.05,
    positionSizeMultiplier: 0.35,
    finalPositionSize: 350,
    portfolioBrainRoute: "SCALP_ROUTE",
  },
  {
    symbol: "NAS100",
    primaryStyle: "SWING",
    activeDirection: "LONG",
    approvalStatus: "APPROVED",
    allowExecution: true,
    requireStrictApproval: false,
    priorityScore: 100,
    positionSizeMultiplier: 0.8,
    finalPositionSize: 960,
    portfolioBrainRoute: "SWING_ROUTE",
  },
  {
    symbol: "SPX500",
    primaryStyle: "NONE",
    activeDirection: "NEUTRAL",
    approvalStatus: "BLOCKED",
    allowExecution: false,
    requireStrictApproval: false,
    priorityScore: 0,
    positionSizeMultiplier: 0,
    finalPositionSize: 0,
    portfolioBrainRoute: "NO_TRADE_ROUTE",
  },
];

function styleUrgencyBoost(input: SchedulerInput) {
  if (input.primaryStyle === "SCALPING") return 12;
  if (input.primaryStyle === "DAYTRADING") return 7;
  if (input.primaryStyle === "SWING") return 4;
  return 0;
}

function strictApprovalPenalty(input: SchedulerInput) {
  return input.requireStrictApproval ? -8 : 0;
}

function calculateExecutionPriority(input: SchedulerInput) {
  if (!input.allowExecution || input.approvalStatus === "BLOCKED") return 0;

  const score =
    input.priorityScore +
    styleUrgencyBoost(input) +
    strictApprovalPenalty(input) +
    input.positionSizeMultiplier * 5;

  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

function resolveSchedulerStatus(input: SchedulerInput): SchedulerStatus {
  if (!input.allowExecution || input.approvalStatus === "BLOCKED") return "BLOCKED";

  if (input.requireStrictApproval) return "WAITING";

  return "SCHEDULED";
}

function resolveExecutionUrgency(priority: number, status: SchedulerStatus): ExecutionUrgency {
  if (status === "BLOCKED") return "NONE";
  if (priority >= 95) return "IMMEDIATE";
  if (priority >= 80) return "HIGH";
  if (priority >= 60) return "NORMAL";
  return "LOW";
}

function createExecutionRule(input: SchedulerInput, status: SchedulerStatus) {
  if (status === "BLOCKED") {
    return "Do not schedule. Execution is blocked.";
  }

  if (status === "WAITING") {
    return "Wait for strict approval confirmation before execution. Keep reduced position size.";
  }

  if (input.primaryStyle === "SCALPING") {
    return "Schedule for fast execution. No overnight hold. Fast exit logic required.";
  }

  if (input.primaryStyle === "DAYTRADING") {
    return "Schedule for intraday execution only. No swing hold.";
  }

  if (input.primaryStyle === "SWING") {
    return "Schedule as swing execution. Higher-timeframe confirmation required.";
  }

  return "No execution rule available.";
}

function buildItem(input: SchedulerInput): ScheduledExecutionItem {
  const schedulerStatus = resolveSchedulerStatus(input);
  const executionPriority = calculateExecutionPriority(input);
  const executionUrgency = resolveExecutionUrgency(executionPriority, schedulerStatus);

  const reason =
    schedulerStatus === "BLOCKED"
      ? `${input.symbol}: Scheduler blocks execution because Trade Approval or style route is blocked.`
      : schedulerStatus === "WAITING"
        ? `${input.symbol}: Scheduler waits because strict approval is required before execution.`
        : `${input.symbol}: Scheduler approved execution for ${input.primaryStyle} ${input.activeDirection}.`;

  return {
    id: `ai-scheduler-${input.symbol.toLowerCase()}-${input.primaryStyle.toLowerCase()}`,
    symbol: input.symbol,
    tradingStyle: input.primaryStyle,
    direction: input.activeDirection,
    schedulerStatus,
    executionUrgency,
    executionPriority,
    queuePosition: 0,
    allowExecution: schedulerStatus === "SCHEDULED",
    requireStrictApproval: input.requireStrictApproval,
    positionSizeMultiplier: input.positionSizeMultiplier,
    finalPositionSize: schedulerStatus === "BLOCKED" ? 0 : input.finalPositionSize,
    portfolioBrainRoute: input.portfolioBrainRoute,
    executionRule: createExecutionRule(input, schedulerStatus),
    reason,
    createdAt: new Date().toISOString(),
  };
}

function assignQueuePositions(items: ScheduledExecutionItem[]) {
  const activeItems = items
    .filter((item) => item.schedulerStatus === "SCHEDULED")
    .sort((a, b) => b.executionPriority - a.executionPriority);

  const waitingItems = items
    .filter((item) => item.schedulerStatus === "WAITING")
    .sort((a, b) => b.executionPriority - a.executionPriority);

  const blockedItems = items.filter((item) => item.schedulerStatus === "BLOCKED");

  return [...activeItems, ...waitingItems, ...blockedItems].map((item, index) => ({
    ...item,
    queuePosition: item.schedulerStatus === "BLOCKED" ? 0 : index + 1,
  }));
}

export function getAIExecutionSchedulerReport(): AIExecutionSchedulerReport {
  const items = assignQueuePositions(schedulerInputs.map(buildItem));

  const scheduledItems = items.filter(
    (item) => item.schedulerStatus === "SCHEDULED",
  ).length;

  const waitingItems = items.filter(
    (item) => item.schedulerStatus === "WAITING",
  ).length;

  const blockedItems = items.filter(
    (item) => item.schedulerStatus === "BLOCKED",
  ).length;

  const immediateItems = items.filter(
    (item) => item.executionUrgency === "IMMEDIATE",
  ).length;

  const highPriorityItems = items.filter(
    (item) => item.executionUrgency === "HIGH",
  ).length;

  const normalPriorityItems = items.filter(
    (item) => item.executionUrgency === "NORMAL",
  ).length;

  const lowPriorityItems = items.filter(
    (item) => item.executionUrgency === "LOW",
  ).length;

  const executionSchedulerMode =
    scheduledItems > 0 ? "ACTIVE" : waitingItems > 0 ? "WAITING" : "BLOCKED";

  const recommendation =
    executionSchedulerMode === "ACTIVE"
      ? "AI Execution Scheduler has active scheduled items. Execute highest priority first and keep waiting items under strict approval watch."
      : executionSchedulerMode === "WAITING"
        ? "AI Execution Scheduler should wait for strict approval confirmation before routing to broker execution."
        : "AI Execution Scheduler should keep execution blocked.";

  return {
    version: "V12.0.0",
    status: "READY",
    mode: "SIMULATION",
    totalInputs: schedulerInputs.length,
    scheduledItems,
    waitingItems,
    blockedItems,
    immediateItems,
    highPriorityItems,
    normalPriorityItems,
    lowPriorityItems,
    executionSchedulerMode,
    items,
    systemRule:
      "AI Execution Scheduler receives style-priority approved trades, assigns execution priority, separates scheduled/waiting/blocked items and prepares broker routing order.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
