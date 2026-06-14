export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { buildPortfolioBrainAdaptiveConfidenceReport } from "@/lib/portfolio-brain/portfolio-brain-adaptive-confidence";

export async function GET() {
  try {
    const adaptiveConfidence = buildPortfolioBrainAdaptiveConfidenceReport();

    return NextResponse.json({
      ok: true,
      adaptiveConfidence,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Adaptive Confidence API error",
      },
      { status: 500 }
    );
  }
}