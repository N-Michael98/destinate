import { NextResponse } from "next/server";
import { generateAutonomousEvolutionTradeApprovalSyncReport } from "@/lib/autonomous-evolution-trade-approval-sync";

export async function GET() {
  try {
    const report = generateAutonomousEvolutionTradeApprovalSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Autonomous Evolution Trade Approval Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
