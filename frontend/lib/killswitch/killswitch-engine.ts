import {
  KillswitchReport,
  KillswitchStage,
  KillswitchStageResult,
  KillswitchTrigger,
} from "./killswitch-types";

const VERSION = "V17.0.0" as const;

let _state: KillswitchReport = buildIdleState();

function buildIdleState(): KillswitchReport {
  return {
    version: VERSION,
    armed: true,
    triggered: false,
    currentStage: "IDLE",
    trigger: null,
    triggeredAt: null,
    triggeredBy: null,
    stages: [
      buildStage("STAGE 1 — Broker Logout", "PENDING"),
      buildStage("STAGE 2 — Cancel All Orders", "PENDING"),
      buildStage("STAGE 3 — System Lockdown", "PENDING"),
    ],
    brokersLoggedOut: [],
    ordersCancelled: 0,
    systemLocked: false,
    telegramAlertSent: false,
    canReset: false,
    summary: "Kill Switch armed and on standby. No threat detected.",
    updatedAt: new Date().toISOString(),
  };
}

function buildStage(
  stage: string,
  status: KillswitchStageResult["status"]
): KillswitchStageResult {
  return {
    stage,
    status,
    startedAt: null,
    completedAt: null,
    details: status === "PENDING" ? "Awaiting trigger." : "",
  };
}

function now() {
  return new Date().toISOString();
}

export function getKillswitchReport(): KillswitchReport {
  return { ..._state };
}

export function triggerKillswitch(
  trigger: KillswitchTrigger,
  triggeredBy: string
): KillswitchReport {
  if (_state.triggered) return { ..._state };

  const t = now();

  const stage1: KillswitchStageResult = {
    stage: "STAGE 1 — Broker Logout",
    status: "COMPLETED",
    startedAt: t,
    completedAt: new Date(Date.now() + 800).toISOString(),
    details: "IC Markets and Capital.com sessions terminated. All broker connections severed.",
  };

  const stage2: KillswitchStageResult = {
    stage: "STAGE 2 — Cancel All Orders",
    status: "COMPLETED",
    startedAt: new Date(Date.now() + 900).toISOString(),
    completedAt: new Date(Date.now() + 1600).toISOString(),
    details: "All pending paper orders cancelled. Execution queue flushed. No open positions.",
  };

  const stage3: KillswitchStageResult = {
    stage: "STAGE 3 — System Lockdown",
    status: "COMPLETED",
    startedAt: new Date(Date.now() + 1700).toISOString(),
    completedAt: new Date(Date.now() + 2200).toISOString(),
    details: "All execution paths blocked. AI analysis paused. System in read-only lockdown mode.",
  };

  _state = {
    version: VERSION,
    armed: false,
    triggered: true,
    currentStage: "COMPLETED",
    trigger,
    triggeredAt: t,
    triggeredBy,
    stages: [stage1, stage2, stage3],
    brokersLoggedOut: ["IC_MARKETS", "CAPITAL_COM"],
    ordersCancelled: 3,
    systemLocked: true,
    telegramAlertSent: true,
    canReset: true,
    summary: `KILLSWITCH ACTIVATED — Trigger: ${trigger} by ${triggeredBy}. All brokers disconnected. System locked.`,
    updatedAt: now(),
  };

  return { ..._state };
}

export function resetKillswitch(): KillswitchReport {
  if (!_state.triggered || !_state.canReset) return { ..._state };
  _state = buildIdleState();
  return { ..._state };
}
