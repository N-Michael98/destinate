import { NextResponse } from "next/server";
import { generateAutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";

export async function GET() {
  try {
    const report = generateAutonomousTradingEvolutionReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Autonomous Trading Evolution report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
