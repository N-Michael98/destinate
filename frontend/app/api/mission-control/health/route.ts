import { NextResponse } from "next/server";
import { scanMissionControlEndpoints } from "@/lib/mission-control/health-scanner";
import { MissionControlEventLog } from "@/lib/mission-control/event-log";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const report = await scanMissionControlEndpoints(baseUrl);

  for (const endpoint of report.endpoints) {
    if (endpoint.status === "ERROR" || endpoint.status === "WARNING") {
      MissionControlEventLog.addDeduped({
        type: `HEALTH_${endpoint.status}`,
        severity: endpoint.status === "ERROR" ? "CRITICAL" : "WARNING",
        source: endpoint.label,
        message: `${endpoint.endpoint} returned ${endpoint.status}. Summary: ${endpoint.summary}`,
        payload: endpoint,
      });
    }
  }

  return NextResponse.json(report);
}
