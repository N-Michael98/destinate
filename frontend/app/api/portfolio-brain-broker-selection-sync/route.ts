import { NextResponse } from "next/server";
import { generatePortfolioBrainBrokerSelectionSyncReport } from "@/lib/portfolio-brain-broker-selection-sync";

export async function GET() {
  try {
    const report = generatePortfolioBrainBrokerSelectionSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Portfolio Brain Broker Selection Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
