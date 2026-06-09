import {
  MissionControlEventLog,
  MissionControlEventLogEntry,
} from "@/lib/mission-control/event-log";

export type MissionControlRecoveryItem = {
  source: string;
  latestIssue: MissionControlEventLogEntry;
  latestRecovery: MissionControlEventLogEntry | null;
  recovered: boolean;
  recoveryTimeMs: number | null;
};

export type MissionControlRecoveryReport = {
  version: "V15.B.25";
  status: "READY";
  totalTrackedSources: number;
  recoveredSources: number;
  activeIssueSources: number;
  averageRecoveryTimeMs: number | null;
  recoveries: MissionControlRecoveryItem[];
  updatedAt: string;
};

function isIssueEvent(event: MissionControlEventLogEntry) {
  return (
    event.severity === "WARNING" ||
    event.severity === "CRITICAL" ||
    event.type.includes("WARNING") ||
    event.type.includes("ERROR") ||
    event.type.includes("FAIL") ||
    event.type.includes("REVIEW")
  );
}

function isRecoveryEvent(event: MissionControlEventLogEntry) {
  return (
    event.severity === "INFO" &&
    (
      event.type.includes("RECOVERY") ||
      event.type.includes("READY") ||
      event.type.includes("PASS")
    )
  );
}

export function buildMissionControlRecoveryReport(): MissionControlRecoveryReport {
  const events = MissionControlEventLog.getAll();

  const sources = Array.from(new Set(events.map((event) => event.source)));

  const recoveries = sources
    .map((source) => {
      const sourceEvents = events
        .filter((event) => event.source === source)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const latestIssue = sourceEvents.find(isIssueEvent);
      const latestRecovery = sourceEvents.find(isRecoveryEvent) ?? null;

      if (!latestIssue) {
        return null;
      }

      const recovered =
        latestRecovery !== null &&
        new Date(latestRecovery.createdAt).getTime() >
          new Date(latestIssue.createdAt).getTime();

      const recoveryTimeMs =
        recovered && latestRecovery
          ? new Date(latestRecovery.createdAt).getTime() -
            new Date(latestIssue.createdAt).getTime()
          : null;

      return {
        source,
        latestIssue,
        latestRecovery,
        recovered,
        recoveryTimeMs,
      };
    })
    .filter((item): item is MissionControlRecoveryItem => item !== null);

  const recovered = recoveries.filter((item) => item.recovered);
  const activeIssues = recoveries.filter((item) => !item.recovered);

  const averageRecoveryTimeMs =
    recovered.length > 0
      ? Math.round(
          recovered.reduce(
            (sum, item) => sum + Number(item.recoveryTimeMs ?? 0),
            0
          ) / recovered.length
        )
      : null;

  return {
    version: "V15.B.25",
    status: "READY",
    totalTrackedSources: recoveries.length,
    recoveredSources: recovered.length,
    activeIssueSources: activeIssues.length,
    averageRecoveryTimeMs,
    recoveries,
    updatedAt: new Date().toISOString(),
  };
}
