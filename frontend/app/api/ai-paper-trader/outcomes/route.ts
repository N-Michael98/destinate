import { NextResponse } from "next/server";
import { AITradeOutcomeTracker } from "@/lib/ai-agent/trade-outcome-tracker";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      outcomes: AITradeOutcomeTracker.analyze(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to analyze AI trade outcomes",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}