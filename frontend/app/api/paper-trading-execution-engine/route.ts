import { NextResponse } from "next/server";
import { buildPaperTradingExecutionReport } from "@/lib/portfolio-brain/paper-trading-execution-engine";

export async function GET() {
  try {
    const paperExecution = buildPaperTradingExecutionReport();

    return NextResponse.json({
      ok: true,
      paperExecution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Paper Trading Execution Engine API error",
      },
      { status: 500 }
    );
  }
}
