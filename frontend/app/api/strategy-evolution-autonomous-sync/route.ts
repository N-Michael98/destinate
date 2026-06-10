import { NextResponse } from "next/server";
import { generateStrategyEvolutionAutonomousSyncReport } from "@/lib/strategy-evolution-autonomous-sync";

export async function GET() {
  try {
    const report = generateStrategyEvolutionAutonomousSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Strategy Evolution Autonomous Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
