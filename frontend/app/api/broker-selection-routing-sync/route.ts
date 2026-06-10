import { NextResponse } from "next/server";
import { generateBrokerSelectionRoutingSyncReport } from "@/lib/broker-selection-routing-sync";

export async function GET() {
  try {
    const report = generateBrokerSelectionRoutingSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Broker Selection Routing Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
