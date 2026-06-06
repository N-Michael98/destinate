import { NextResponse } from "next/server";
import { buildPortfolioBrainOutcomeLearningSyncReport } from "@/lib/portfolio-brain/portfolio-brain-outcome-learning-sync";

export async function GET() {
  try {
    const outcomeLearningSync = buildPortfolioBrainOutcomeLearningSyncReport();

    return NextResponse.json({
      ok: true,
      outcomeLearningSync,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Outcome Learning Sync API error",
      },
      { status: 500 }
    );
  }
}