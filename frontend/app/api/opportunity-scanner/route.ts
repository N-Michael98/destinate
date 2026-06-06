import { NextResponse } from "next/server";
import { buildOpportunityScannerReport } from "@/lib/market-universe/opportunity-scanner";

export async function GET() {
  try {
    const scanner = buildOpportunityScannerReport();

    return NextResponse.json({
      ok: true,
      scanner,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Opportunity Scanner API error",
      },
      { status: 500 }
    );
  }
}