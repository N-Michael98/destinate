export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { buildDynamicMarketDataReport } from "@/lib/market-universe/dynamic-market-data";

export async function GET() {
  try {
    const marketData = buildDynamicMarketDataReport();

    return NextResponse.json({
      ok: true,
      marketData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Dynamic Market Data API error",
      },
      { status: 500 }
    );
  }
}