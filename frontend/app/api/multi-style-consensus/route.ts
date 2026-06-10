import { NextResponse } from "next/server";
import { generateMultiStyleConsensusReport } from "@/lib/multi-style-consensus";

export async function GET() {
  try {
    const report = generateMultiStyleConsensusReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Multi-Style Consensus report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
