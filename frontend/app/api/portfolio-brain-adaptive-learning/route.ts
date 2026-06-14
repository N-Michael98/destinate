export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { buildPortfolioBrainAdaptiveLearningReport } from "@/lib/portfolio-brain/portfolio-brain-adaptive-learning";

export async function GET() {
  try {
    const adaptiveLearning = buildPortfolioBrainAdaptiveLearningReport();

    return NextResponse.json({
      ok: true,
      adaptiveLearning,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Adaptive Learning API error",
      },
      { status: 500 }
    );
  }
}