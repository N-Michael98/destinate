export type DependencyStatus =
  | "ACTIVE"
  | "CENTER_ACTIVE"
  | "LEGACY_REVIEW"
  | "MERGE_TARGET"
  | "ARCHIVE_LATER";

export type HealthStatus =
  | "HEALTHY"
  | "WARNING"
  | "CRITICAL"
  | "UNKNOWN";

export type DependencyLayer =
  | "AI"
  | "EVOLUTION"
  | "EXECUTION"
  | "BROKER"
  | "LEARNING"
  | "MARKET"
  | "PORTFOLIO"
  | "LEGACY";

export type DependencyItem = {
  id: string;
  name: string;
  layer: DependencyLayer;
  apiRoute?: string;
  component?: string;
  status: DependencyStatus;
  healthStatus: HealthStatus;
  dependsOn: string[];
  feedsInto: string[];
  notificationRequired: boolean;
  telegramAlertReady: boolean;
  note: string;
};

export type DependencyScannerReport = {
  version: "V15.A.5";
  status: "READY";
  mode: "SIMULATION";
  totalItems: number;
  activeItems: number;
  centerActiveItems: number;
  legacyReviewItems: number;
  mergeTargetItems: number;
  archiveLaterItems: number;
  healthyItems: number;
  warningItems: number;
  criticalItems: number;
  notificationRequiredItems: number;
  telegramReadyItems: number;
  dependencyItems: DependencyItem[];
  futureTelegramAlertPlan: {
    enabledNow: false;
    planned: true;
    trigger: string;
    target: "TELEGRAM";
    messageTemplate: string;
  };
  summary: string;
};
