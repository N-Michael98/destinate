export type MissionControlAlertHistoryItem = {
  key: string;
  label: string;
  endpoint: string;
  group: string;
  status: "WARNING" | "ERROR";
  severity: "REVIEW" | "CRITICAL";
  summary: string;
  critical: boolean;
};

export function buildAlertHistorySnapshot(
  sources: {
    key?: string;
    label: string;
    endpoint: string;
    group?: string;
    critical?: boolean;
    status: "READY" | "WARNING" | "ERROR" | "LOADING";
    summary: string;
  }[]
): MissionControlAlertHistoryItem[] {
  return sources
    .filter((source) => source.status === "WARNING" || source.status === "ERROR")
    .map((source) => ({
      key: source.key || source.endpoint,
      label: source.label,
      endpoint: source.endpoint,
      group: source.group || "UNKNOWN",
      status: source.status === "ERROR" ? "ERROR" : "WARNING",
      severity: source.status === "ERROR" ? "CRITICAL" : "REVIEW",
      summary: source.summary,
      critical: Boolean(source.critical),
    }));
}

export function countCriticalAlertHistory(
  history: MissionControlAlertHistoryItem[]
) {
  return history.filter((item) => item.severity === "CRITICAL").length;
}

export function countReviewAlertHistory(
  history: MissionControlAlertHistoryItem[]
) {
  return history.filter((item) => item.severity === "REVIEW").length;
}
