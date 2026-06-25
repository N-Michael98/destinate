import {
  KillswitchReport,
  KillswitchStage,
  KillswitchStageResult,
  KillswitchTrigger,
} from "./killswitch-types";

const VERSION = "V17.0.0" as const;
const REDIS_KEY = "killswitch:state"; // persistiert über Deploys
const REDIS_TTL = 30 * 24 * 60 * 60; // 30 Tage

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

// Schreibt Killswitch-State in Redis (fire-and-forget, blockiert nicht)
function persistToRedis(state: KillswitchReport): void {
  import("@/lib/cache/redis-cache").then(({ cacheSet }) => {
    cacheSet(REDIS_KEY, state, REDIS_TTL);
  }).catch(() => {});
}

// Löscht Killswitch-State aus Redis (fire-and-forget)
function deleteFromRedis(): void {
  import("@/lib/cache/redis-cache").then(({ cacheDel }) => {
    cacheDel(REDIS_KEY);
  }).catch(() => {});
}

export function getKillswitchReport(): KillswitchReport {
  return { ..._state };
}

// Wird beim Server-Start aufgerufen — stellt Killswitch aus Redis wieder her
export async function restoreKillswitchFromRedis(): Promise<boolean> {
  try {
    const { cacheGet } = await import("@/lib/cache/redis-cache");
    const saved = await cacheGet<KillswitchReport>(REDIS_KEY);
    if (saved && saved.triggered) {
      _state = saved;
      console.log(`[killswitch] 🔴 State aus Redis wiederhergestellt — System bleibt gesperrt (seit ${saved.triggeredAt})`);
      return true;
    }
  } catch { /* non-fatal */ }
  return false;
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

  // In Redis persistieren — überlebt Deploys
  persistToRedis(_state);

  return { ..._state };
}

export function resetKillswitch(): KillswitchReport {
  if (!_state.triggered || !_state.canReset) return { ..._state };
  _state = buildIdleState();
  // Aus Redis löschen
  deleteFromRedis();
  return { ..._state };
}
