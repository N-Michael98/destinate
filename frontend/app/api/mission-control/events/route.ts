export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { MissionControlEventLog } from "@/lib/mission-control/event-log";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      events: MissionControlEventLog.getAll(),
      latest: MissionControlEventLog.getLatest(25),
      critical: MissionControlEventLog.getBySeverity("CRITICAL", 25),
      warnings: MissionControlEventLog.getBySeverity("WARNING", 25),
      stats: MissionControlEventLog.getStats(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load Mission Control event log",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
