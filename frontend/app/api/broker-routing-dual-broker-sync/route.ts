import { NextResponse } from "next/server";
import { generateBrokerRoutingDualBrokerSyncReport } from "@/lib/broker-routing-dual-broker-sync";

export async function GET() {
  try {
    const report = generateBrokerRoutingDualBrokerSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Broker Routing Dual Broker Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
