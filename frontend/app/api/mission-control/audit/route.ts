import { NextResponse } from "next/server";
import { runMissionControlAudit } from "@/lib/mission-control/system-audit";
import { MissionControlEventLog } from "@/lib/mission-control/event-log";

export async function GET() {
  const report = runMissionControlAudit();

  for (const check of report.checks) {
    if (check.status === "FAIL" || check.status === "REVIEW") {
      MissionControlEventLog.addDeduped({
        type: `AUDIT_${check.status}`,
        severity: check.status === "FAIL" ? "CRITICAL" : "WARNING",
        source: check.title,
        message: check.message,
        payload: check,
      });
    }
  }

  return NextResponse.json(report);
}
