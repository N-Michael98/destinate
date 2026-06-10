import { NextResponse } from "next/server";
import { generateMultiStyleConsensusUnifiedDecisionSyncReport } from "@/lib/multi-style-consensus-unified-decision-sync";

export async function GET() {
  try {
    const report = generateMultiStyleConsensusUnifiedDecisionSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Multi-Style Consensus Unified Decision Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
