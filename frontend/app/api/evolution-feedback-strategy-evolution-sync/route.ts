import { NextResponse } from "next/server";
import { generateEvolutionFeedbackStrategyEvolutionSyncReport } from "@/lib/evolution-feedback-strategy-evolution-sync";

export async function GET() {
  try {
    const report = generateEvolutionFeedbackStrategyEvolutionSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Evolution Feedback Strategy Evolution Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
