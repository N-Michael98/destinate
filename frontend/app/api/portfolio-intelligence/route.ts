export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPortfolioIntelligenceReport } from "@/lib/portfolio-intelligence";

export async function GET() {
  try {
    const report = getPortfolioIntelligenceReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate portfolio intelligence report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}