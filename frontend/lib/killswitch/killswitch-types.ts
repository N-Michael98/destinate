export type KillswitchStage =
  | "IDLE"
  | "STAGE_1_BROKER_LOGOUT"
  | "STAGE_2_CANCEL_ORDERS"
  | "STAGE_3_SYSTEM_LOCKDOWN"
  | "COMPLETED"
  | "FAILED";

export type KillswitchTrigger =
  | "MANUAL"
  | "MALWAREBYTES_THREAT"
  | "INTRUSION_DETECTED"
  | "ANOMALY_DETECTED"
  | "API_BREACH"
  | "AI_WATCHDOG";

export interface KillswitchStageResult {
  stage: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  startedAt: string | null;
  completedAt: string | null;
  details: string;
}

export interface KillswitchReport {
  version: "V17.0.0";
  armed: boolean;
  triggered: boolean;
  currentStage: KillswitchStage;
  trigger: KillswitchTrigger | null;
  triggeredAt: string | null;
  triggeredBy: string | null;
  stages: KillswitchStageResult[];
  brokersLoggedOut: string[];
  ordersCancelled: number;
  systemLocked: boolean;
  telegramAlertSent: boolean;
  canReset: boolean;
  summary: string;
  updatedAt: string;
}
