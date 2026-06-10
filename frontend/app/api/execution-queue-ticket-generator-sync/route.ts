import { NextResponse } from "next/server";
import { generateExecutionQueueTicketGeneratorSyncReport } from "@/lib/execution-queue-ticket-generator-sync";

export async function GET() {
  try {
    const report = generateExecutionQueueTicketGeneratorSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Execution Queue Ticket Generator Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
