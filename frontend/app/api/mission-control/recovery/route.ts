import { NextResponse } from "next/server";
import { buildMissionControlRecoveryReport } from "@/lib/mission-control/recovery-tracker";

export async function GET() {
  try {
    const recovery = buildMissionControlRecoveryReport();

    return NextResponse.json({
      ok: true,
      recovery,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load Mission Control recovery report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
