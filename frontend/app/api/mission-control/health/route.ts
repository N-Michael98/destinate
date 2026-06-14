export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { scanMissionControlEndpoints } from "@/lib/mission-control/health-scanner";
import { MissionControlEventLog } from "@/lib/mission-control/event-log";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const report = await scanMissionControlEndpoints(baseUrl);

  const events = MissionControlEventLog.getAll();

  for (const endpoint of report.endpoints) {
    if (endpoint.status === "ERROR" || endpoint.status === "WARNING") {
      MissionControlEventLog.addDeduped({
        type: `HEALTH_${endpoint.status}`,
        severity: endpoint.status === "ERROR" ? "CRITICAL" : "WARNING",
        source: endpoint.label,
        message: `${endpoint.endpoint} returned ${endpoint.status}. Summary: ${endpoint.summary}`,
        payload: endpoint,
      });

      continue;
    }

    if (endpoint.status === "READY") {
      const sourceEvents = events
        .filter((event) => event.source === endpoint.label)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const latestIssue = sourceEvents.find(
        (event) =>
          event.severity === "WARNING" ||
          event.severity === "CRITICAL" ||
          event.type.includes("WARNING") ||
          event.type.includes("ERROR")
      );

      const latestRecovery = sourceEvents.find(
        (event) =>
          event.severity === "INFO" &&
          (
            event.type.includes("RECOVERY") ||
            event.type.includes("READY")
          )
      );

      if (
        latestIssue &&
        (
          !latestRecovery ||
          new Date(latestRecovery.createdAt).getTime() <
            new Date(latestIssue.createdAt).getTime()
        )
      ) {
        MissionControlEventLog.addDeduped({
          type: "HEALTH_RECOVERY",
          severity: "INFO",
          source: endpoint.label,
          message: `${endpoint.endpoint} recovered and is READY again.`,
          payload: endpoint,
        });
      }
    }
  }

  return NextResponse.json(report);
}

