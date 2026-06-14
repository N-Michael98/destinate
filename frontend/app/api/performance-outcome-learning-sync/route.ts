export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generatePerformanceOutcomeLearningSyncReport } from "@/lib/performance-outcome-learning-sync";

export async function GET() {
  try {
    const report = generatePerformanceOutcomeLearningSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Performance Outcome Learning Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
