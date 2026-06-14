export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generatePositionSizingEvolutionSyncReport } from "@/lib/position-sizing-evolution-sync";

export async function GET() {
  try {
    const report = generatePositionSizingEvolutionSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Position Sizing Evolution Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
