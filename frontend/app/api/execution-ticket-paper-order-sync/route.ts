import { NextResponse } from "next/server";
import { generateExecutionTicketPaperOrderSyncReport } from "@/lib/execution-ticket-paper-order-sync";

export async function GET() {
  try {
    const report = generateExecutionTicketPaperOrderSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Execution Ticket Paper Order Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
