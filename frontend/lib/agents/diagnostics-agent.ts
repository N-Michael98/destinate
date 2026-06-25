/**
 * DiagnosticsAgent — Qualitätskontrolle für alle Agents
 *
 * Aufgaben:
 * - Hört alle Bus-Events ab und erkennt Anomalien
 * - Merkt sich Muster ("BE 3x nicht gesetzt obwohl es sollte")
 * - Überwacht Agent-Herzschläge (Heartbeat)
 * - Schickt Telegram-Alarm bei kritischen Problemen
 * - Erstellt Health-Reports
 */

import { agentBus, type AgentEvent, type AgentEventType } from "./agent-bus";

const AGENT_ID = "DiagnosticsAgent";

// ── Typen ─────────────────────────────────────────────────────────────────────

interface AnomalyRecord {
  type: string;
  symbol?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  details: string[];
}

interface AgentHeartbeat {
  agentId: string;
  lastSeen: string;
  cycleCount: number;
  errorCount: number;
  status: "OK" | "WARN" | "DEAD";
}

interface DiagnosticsReport {
  generatedAt: string;
  agents: AgentHeartbeat[];
  anomalies: AnomalyRecord[];
  recentErrors: AgentEvent[];
  systemStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  summary: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

const anomalies = new Map<string, AnomalyRecord>();
const heartbeats = new Map<string, AgentHeartbeat>();
const recentErrors: AgentEvent[] = [];
const MAX_ERRORS = 100;

// Schwellenwerte für Alarme
const ANOMALY_ALERT_THRESHOLD = 3;   // ab 3x dasselbe Problem → Alarm
const AGENT_DEAD_MINUTES = 10;       // Agent gilt als tot wenn >10min kein Heartbeat

// ── Anomalie-Erkennung ────────────────────────────────────────────────────────

function recordAnomaly(type: string, detail: string, symbol?: string): void {
  const key = symbol ? `${type}:${symbol}` : type;
  const existing = anomalies.get(key);
  const now = new Date().toISOString();

  if (existing) {
    existing.count++;
    existing.lastSeen = now;
    existing.details.push(detail);
    if (existing.details.length > 20) existing.details.shift(); // Rolling window
    anomalies.set(key, existing);
  } else {
    anomalies.set(key, {
      type,
      symbol,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      details: [detail],
    });
  }

  const record = anomalies.get(key)!;
  if (record.count === ANOMALY_ALERT_THRESHOLD) {
    // Kritische Schwelle erreicht → Telegram-Alarm
    sendDiagnosticsAlert(
      `⚠️ Anomalie erkannt: ${type}${symbol ? ` [${symbol}]` : ""}\n` +
      `Anzahl: ${record.count}x seit ${record.firstSeen}\n` +
      `Zuletzt: ${detail}`
    ).catch(() => {});
  }

  console.log(`[diag-agent] 🔍 Anomalie: ${key} (${record.count}x) — ${detail}`);
}

function updateHeartbeat(agentId: string, isError = false): void {
  const existing = heartbeats.get(agentId);
  heartbeats.set(agentId, {
    agentId,
    lastSeen: new Date().toISOString(),
    cycleCount: (existing?.cycleCount ?? 0) + (isError ? 0 : 1),
    errorCount: (existing?.errorCount ?? 0) + (isError ? 1 : 0),
    status: isError ? "WARN" : "OK",
  });
}

// ── Event-Handler ─────────────────────────────────────────────────────────────

function handleEvent(event: AgentEvent): void {
  updateHeartbeat(event.agentId, event.type.endsWith("ERROR"));

  switch (event.type) {
    case "RISK:ERROR": {
      recentErrors.push(event);
      if (recentErrors.length > MAX_ERRORS) recentErrors.shift();

      const symbol = String(event.payload.symbol ?? "");
      const error = String(event.payload.error ?? "");
      recordAnomaly("RISK_ERROR", error, symbol);

      // Sofort-Alarm bei kritischen Fehlern
      if (error.includes("ECONNREFUSED") || error.includes("401") || error.includes("403")) {
        sendDiagnosticsAlert(
          `🚨 Kritischer RiskAgent-Fehler:\n${symbol}: ${error}`
        ).catch(() => {});
      }
      break;
    }

    case "RISK:BE_SET": {
      const symbol = String(event.payload.symbol ?? "");
      const progress = Number(event.payload.progress ?? 0);
      console.log(`[diag-agent] ✅ BE gesetzt: ${symbol} bei ${(progress*100).toFixed(0)}%`);
      break;
    }

    case "RISK:TRAIL_UPDATED": {
      const symbol = String(event.payload.symbol ?? "");
      // Prüfe ob Trail SL sich in die falsche Richtung bewegt (Fehler-Indikator)
      const newTrailSL = Number(event.payload.newTrailSL ?? 0);
      if (newTrailSL <= 0) {
        recordAnomaly("TRAIL_INVALID_SL", `newTrailSL=${newTrailSL}`, symbol);
      }
      break;
    }

    case "RISK:PARTIAL_TP": {
      const symbol = String(event.payload.symbol ?? "");
      console.log(`[diag-agent] 💰 Partial TP: ${symbol}`);
      break;
    }

    case "RISK:POSITION_CLOSED": {
      const { symbol, reason } = event.payload;
      console.log(`[diag-agent] 🔒 Position geschlossen: ${symbol} (${reason})`);
      break;
    }

    case "EXECUTION:TRADE_OPENED": {
      updateHeartbeat("ExecutionAgent");
      break;
    }

    case "DIAGNOSTICS:HEALTH_CHECK": {
      // Anderer Agent fragt nach Status
      const report = generateReport();
      agentBus.publish({
        type: "DIAGNOSTICS:ALERT",
        agentId: AGENT_ID,
        timestamp: new Date().toISOString(),
        payload: { report },
      });
      break;
    }
  }
}

// ── Health-Check: tote Agents erkennen ───────────────────────────────────────

function checkAgentHealth(): void {
  const now = Date.now();
  const knownAgents = ["RiskAgent", "ExecutionAgent", "OrchestratorAgent", "AnalysisAgent"];

  for (const agentId of knownAgents) {
    const hb = heartbeats.get(agentId);
    if (!hb) continue;

    const minutesSince = (now - new Date(hb.lastSeen).getTime()) / 60_000;

    if (minutesSince > AGENT_DEAD_MINUTES && hb.status !== "DEAD") {
      heartbeats.set(agentId, { ...hb, status: "DEAD" });
      recordAnomaly("AGENT_DEAD", `Kein Heartbeat seit ${minutesSince.toFixed(0)} min`, agentId);
      sendDiagnosticsAlert(
        `💀 Agent nicht mehr aktiv: ${agentId}\nLetztes Signal: ${hb.lastSeen}`
      ).catch(() => {});
    } else if (minutesSince <= AGENT_DEAD_MINUTES && hb.status === "DEAD") {
      heartbeats.set(agentId, { ...hb, status: "OK" });
      console.log(`[diag-agent] ✅ ${agentId} wieder aktiv`);
    }
  }
}

// ── Report generieren ─────────────────────────────────────────────────────────

function generateReport(): DiagnosticsReport {
  const agents = [...heartbeats.values()];
  const allAnomalies = [...anomalies.values()];
  const criticalAnomalies = allAnomalies.filter(a => a.count >= ANOMALY_ALERT_THRESHOLD);
  const deadAgents = agents.filter(a => a.status === "DEAD");

  let systemStatus: DiagnosticsReport["systemStatus"] = "HEALTHY";
  if (deadAgents.length > 0) systemStatus = "CRITICAL";
  else if (criticalAnomalies.length > 0) systemStatus = "DEGRADED";

  const summary = systemStatus === "HEALTHY"
    ? `Alle ${agents.length} Agents aktiv, keine kritischen Anomalien`
    : systemStatus === "DEGRADED"
    ? `${criticalAnomalies.length} kritische Anomalie(n) erkannt`
    : `${deadAgents.length} Agent(s) nicht erreichbar: ${deadAgents.map(a => a.agentId).join(", ")}`;

  return {
    generatedAt: new Date().toISOString(),
    agents,
    anomalies: allAnomalies,
    recentErrors: recentErrors.slice(-20),
    systemStatus,
    summary,
  };
}

// ── Telegram-Alarm ────────────────────────────────────────────────────────────

async function sendDiagnosticsAlert(message: string): Promise<void> {
  try {
    const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
    await sendTelegram(`🤖 DiagnosticsAgent\n${message}`);
  } catch {
    console.error("[diag-agent] Telegram-Alarm konnte nicht gesendet werden");
  }
}

// ── Öffentliche API ───────────────────────────────────────────────────────────

let initialized = false;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

export function initDiagnosticsAgent(): void {
  if (initialized) return;
  initialized = true;

  // Alle Bus-Events abonnieren
  const eventTypes: AgentEventType[] = [
    "RISK:BE_SET", "RISK:TRAIL_UPDATED", "RISK:PARTIAL_TP",
    "RISK:POSITION_CLOSED", "RISK:ERROR",
    "EXECUTION:TRADE_OPENED", "EXECUTION:TRADE_CLOSED",
    "DIAGNOSTICS:HEALTH_CHECK",
  ];

  for (const type of eventTypes) {
    agentBus.subscribe(type, handleEvent);
  }

  // Health-Check alle 5 Minuten
  healthCheckInterval = setInterval(checkAgentHealth, 5 * 60 * 1000);

  console.log("[diag-agent] ✅ DiagnosticsAgent gestartet — überwacht alle Agents");
}

export function getDiagnosticsReport(): DiagnosticsReport {
  return generateReport();
}

export function clearAnomalies(): void {
  anomalies.clear();
  recentErrors.length = 0;
  console.log("[diag-agent] Anomalien zurückgesetzt");
}

export function stopDiagnosticsAgent(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  initialized = false;
}
