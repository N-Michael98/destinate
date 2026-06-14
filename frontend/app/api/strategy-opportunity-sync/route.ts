export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { buildStrategyOpportunitySyncReport } from "@/lib/market-universe/strategy-opportunity-sync";

export async function GET() {
  try {
    const strategyOpportunitySync = buildStrategyOpportunitySyncReport();

    return NextResponse.json({
      ok: true,
      strategyOpportunitySync,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Strategy Opportunity Sync API error",
      },
      { status: 500 }
    );
  }
}