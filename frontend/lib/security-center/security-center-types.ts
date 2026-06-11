export type ThreatLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SecurityStatus = "SECURE" | "MONITORING" | "ALERT" | "LOCKDOWN";
export type AuditEventType =
  | "SYSTEM_START"
  | "SYSTEM_STOP"
  | "BROKER_CONNECTED"
  | "BROKER_DISCONNECTED"
  | "KILLSWITCH_TRIGGERED"
  | "THREAT_DETECTED"
  | "THREAT_CLEARED"
  | "MALWAREBYTES_SCAN"
  | "TELEGRAM_SENT"
  | "LOGIN_ATTEMPT"
  | "PERMISSION_CHANGE";

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  source: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SystemPermission {
  id: string;
  name: string;
  status: "ALLOWED" | "BLOCKED" | "REQUIRES_APPROVAL";
  description: string;
}

export interface SecurityCenterReport {
  version: "V17.0.0";
  status: SecurityStatus;
  threatLevel: ThreatLevel;
  malwarebytesConnected: boolean;
  killswitchArmed: boolean;
  killswitchTriggered: boolean;
  telegramConfigured: boolean;
  brokerSessionsActive: number;
  openOrdersCount: number;
  permissions: SystemPermission[];
  auditLog: AuditEvent[];
  lastScanAt: string | null;
  lastThreatAt: string | null;
  summary: string;
  safety: {
    liveTradingEnabled: false;
    dataExposureEnabled: false;
    malwarebytesDataAccess: "PROTECTION_STATUS_ONLY";
  };
  updatedAt: string;
}
