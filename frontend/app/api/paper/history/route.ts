import { NextResponse } from "next/server";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      history: paperTradingManager.getHistory(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load paper trading history",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}