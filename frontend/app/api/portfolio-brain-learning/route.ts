import { NextResponse } from "next/server";
import { buildPortfolioBrainLearningReport } from "@/lib/portfolio-brain/portfolio-brain-learning";

export async function GET() {
  try {
    const learning = buildPortfolioBrainLearningReport();

    return NextResponse.json({
      ok: true,
      learning,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Learning API error",
      },
      { status: 500 }
    );
  }
}