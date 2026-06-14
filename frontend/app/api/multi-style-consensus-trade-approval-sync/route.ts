export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateMultiStyleConsensusTradeApprovalSyncReport } from "@/lib/multi-style-consensus-trade-approval-sync";

export async function GET() {
  try {
    const report = generateMultiStyleConsensusTradeApprovalSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Multi-Style Consensus Trade Approval Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
