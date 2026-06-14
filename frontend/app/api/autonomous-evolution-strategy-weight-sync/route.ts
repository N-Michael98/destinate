export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateAutonomousEvolutionStrategyWeightSyncReport } from "@/lib/autonomous-evolution-strategy-weight-sync";

export async function GET() {
  try {
    const report = generateAutonomousEvolutionStrategyWeightSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Autonomous Evolution Strategy Weight Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
