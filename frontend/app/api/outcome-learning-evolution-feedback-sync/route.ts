export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateOutcomeLearningEvolutionFeedbackSyncReport } from "@/lib/outcome-learning-evolution-feedback-sync";

export async function GET() {
  try {
    const report = generateOutcomeLearningEvolutionFeedbackSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Outcome Learning Evolution Feedback Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
