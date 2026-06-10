import { NextResponse } from "next/server";
import { generateDualBrokerExecutionQueueSyncReport } from "@/lib/dual-broker-execution-queue-sync";

export async function GET() {
  try {
    const report = generateDualBrokerExecutionQueueSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Dual Broker Execution Queue Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
