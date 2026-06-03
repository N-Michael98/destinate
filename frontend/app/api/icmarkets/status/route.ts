import { NextResponse } from "next/server";
import { icMarketsManager } from "@/lib/icmarkets-connector";

export async function GET() {
  try {
    const status = icMarketsManager.getStatus();
    const account = await icMarketsManager.getAccountSnapshot();
    const health = await icMarketsManager.getAccountHealth();
    const exposure = await icMarketsManager.getExposureSummary();

    return NextResponse.json({
      success: true,
      broker: "IC_MARKETS",
      status,
      account,
      health,
      exposure,
      liveTradingEnabled: false,
      message: "IC Markets connector is running in safe read-only/demo mode.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        broker: "IC_MARKETS",
        error:
          error instanceof Error
            ? error.message
            : "Unknown IC Markets connector error",
        liveTradingEnabled: false,
      },
      { status: 500 }
    );
  }
}