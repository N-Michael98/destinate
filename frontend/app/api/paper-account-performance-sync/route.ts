export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generatePaperAccountPerformanceSyncReport } from "@/lib/paper-account-performance-sync";

export async function GET() {
  try {
    const report = generatePaperAccountPerformanceSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Paper Account Performance Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
