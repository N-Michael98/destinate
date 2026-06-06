import { NextResponse } from "next/server";
import { buildMarketRegimeSyncReport } from "@/lib/market-universe/market-regime-sync";

export async function GET() {
  try {
    const regimeSync = buildMarketRegimeSyncReport();

    return NextResponse.json({
      ok: true,
      regimeSync,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Market Regime Sync API error",
      },
      { status: 500 }
    );
  }
}