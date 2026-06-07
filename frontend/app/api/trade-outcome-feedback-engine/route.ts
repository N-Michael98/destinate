import { NextResponse } from "next/server";
import { buildTradeOutcomeFeedbackReport } from "@/lib/portfolio-brain/trade-outcome-feedback-engine";

export async function GET() {
  try {
    const tradeOutcomeFeedback = buildTradeOutcomeFeedbackReport();

    return NextResponse.json({
      ok: true,
      tradeOutcomeFeedback,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Trade Outcome Feedback Engine API error",
      },
      { status: 500 }
    );
  }
}
