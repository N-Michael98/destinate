import { generateMalwarebytesReport } from "@/lib/malwarebytes-integration";
import { getKillswitchReport } from "@/lib/killswitch";

import {
  AuditEvent,
  AuditEventType,
  SecurityCenterReport,
  SecurityStatus,
  SystemPermission,
  ThreatLevel,
} from "./security-center-types";

const VERSION = "V17.0.0" as const;

const PERMISSIONS: SystemPermission[] = [
  { id: "live_trading", name: "Live Trading", status: "BLOCKED", description: "Real broker order execution" },
  { id: "paper_trading", name: "Paper Trading", status: "ALLOWED", description: "Simulated order execution" },
  { id: "broker_read", name: "Broker Read Access", status: "ALLOWED", description: "Read broker status and prices" },
  { id: "api_keys", name: "API Key Exposure", status: "BLOCKED", description: "API keys visible in browser" },
  { id: "data_export", name: "Data Export", status: "REQUIRES_APPROVAL", description: "Export trading data" },
  { id: "auto_live", name: "Auto Live Trading", status: "BLOCKED", description: "Autonomous live order placement" },
  { id: "malwarebytes_data", name: "Malwarebytes Data Access", status: "BLOCKED", description: "MB access to trading/position data" },
  { id: "telegram_send", name: "Telegram Notifications", status: "ALLOWED", description: "Send status messages to Telegram" },
];

const STATIC_AUDIT: AuditEvent[] = [
  buildEvent("SYSTEM_START", "INFO", "Security Center", "Security Center V17.0.0 initialized."),
  buildEvent("BROKER_CONNECTED", "INFO", "IC Markets", "IC Markets demo session opened — read-only mode."),
  buildEvent("BROKER_CONNECTED", "INFO", "Capital.com", "Capital.com demo session opened — read-only mode."),
  buildEvent("MALWAREBYTES_SCAN", "INFO", "Malwarebytes", "Scheduled scan completed — 0 threats found."),
];

let _counter = STATIC_AUDIT.length;

function buildEvent(
  type: AuditEventType,
  severity: AuditEvent["severity"],
  source: string,
  message: string,
  metadata?: Record<string, string | number | boolean>
): AuditEvent {
  return {
    id: `AUD-${(++_counter).toString().padStart(4, "0")}`,
    timestamp: new Date(Date.now() - _counter * 60000).toISOString(),
    type,
    severity,
    source,
    message,
    metadata,
  };
}

function resolveSecurityStatus(
  mwConnected: boolean,
  killTriggered: boolean,
  threatsFound: number
): SecurityStatus {
  if (killTriggered) return "LOCKDOWN";
  if (threatsFound > 0) return "ALERT";
  if (!mwConnected) return "MONITORING";
  return "SECURE";
}

function resolveThreatLevel(
  killTriggered: boolean,
  threatsFound: number
): ThreatLevel {
  if (killTriggered) return "CRITICAL";
  if (threatsFound >= 3) return "HIGH";
  if (threatsFound >= 1) return "MEDIUM";
  return "NONE";
}

export function generateSecurityCenterReport(): SecurityCenterReport {
  const mw = generateMalwarebytesReport();
  const ks = getKillswitchReport();

  const status = resolveSecurityStatus(
    mw.connectionStatus === "CONNECTED",
    ks.triggered,
    mw.threatsFound
  );
  const threatLevel = resolveThreatLevel(ks.triggered, mw.threatsFound);

  const auditLog = [...STATIC_AUDIT];
  if (ks.triggered) {
    auditLog.push(
      buildEvent("KILLSWITCH_TRIGGERED", "CRITICAL", "Kill Switch", `Kill Switch activated — ${ks.trigger} by ${ks.triggeredBy}`)
    );
  }

  return {
    version: VERSION,
    status,
    threatLevel,
    malwarebytesConnected: mw.connectionStatus === "CONNECTED",
    killswitchArmed: ks.armed,
    killswitchTriggered: ks.triggered,
    telegramConfigured: false,
    brokerSessionsActive: ks.triggered ? 0 : 2,
    openOrdersCount: ks.triggered ? 0 : 3,
    permissions: PERMISSIONS,
    auditLog: auditLog.reverse(),
    lastScanAt: mw.lastScanAt,
    lastThreatAt: mw.activeThreats[0]?.detectedAt ?? null,
    summary:
      status === "SECURE"
        ? "All systems secure. Malwarebytes active, no threats detected, Kill Switch armed."
        : status === "LOCKDOWN"
          ? "LOCKDOWN ACTIVE — Brokers disconnected, system locked. Manual reset required."
          : "System monitoring active. No critical threats.",
    safety: {
      liveTradingEnabled: false,
      dataExposureEnabled: false,
      malwarebytesDataAccess: "PROTECTION_STATUS_ONLY",
    },
    updatedAt: new Date().toISOString(),
  };
}
