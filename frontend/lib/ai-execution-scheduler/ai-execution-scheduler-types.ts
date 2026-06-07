export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING" | "NONE";

export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type SchedulerStatus =
  | "SCHEDULED"
  | "WAITING"
  | "BLOCKED";

export type ExecutionUrgency =
  | "IMMEDIATE"
  | "HIGH"
  | "NORMAL"
  | "LOW"
  | "NONE";

export type SchedulerInput = {
  symbol: string;
  primaryStyle: TradingStyle;
  activeDirection: Direction;
  approvalStatus: "APPROVED" | "STRICT_APPROVAL_REQUIRED" | "BLOCKED";
  allowExecution: boolean;
  requireStrictApproval: boolean;
  priorityScore: number;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  portfolioBrainRoute: string;
};

export type ScheduledExecutionItem = {
  id: string;
  symbol: string;
  tradingStyle: TradingStyle;
  direction: Direction;
  schedulerStatus: SchedulerStatus;
  executionUrgency: ExecutionUrgency;
  executionPriority: number;
  queuePosition: number;
  allowExecution: boolean;
  requireStrictApproval: boolean;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  portfolioBrainRoute: string;
  executionRule: string;
  reason: string;
  createdAt: string;
};

export type AIExecutionSchedulerReport = {
  version: "V12.0.0";
  status: "READY";
  mode: "SIMULATION";
  totalInputs: number;
  scheduledItems: number;
  waitingItems: number;
  blockedItems: number;
  immediateItems: number;
  highPriorityItems: number;
  normalPriorityItems: number;
  lowPriorityItems: number;
  executionSchedulerMode: "ACTIVE" | "WAITING" | "BLOCKED";
  items: ScheduledExecutionItem[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
