export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { buildPortfolioBrainOutcomeReport } from "@/lib/portfolio-brain/portfolio-brain-outcomes";

export async function GET() {
  try {
    const outcomes = buildPortfolioBrainOutcomeReport();

    return NextResponse.json({
      ok: true,
      outcomes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Outcomes API error",
      },
      { status: 500 }
    );
  }
}