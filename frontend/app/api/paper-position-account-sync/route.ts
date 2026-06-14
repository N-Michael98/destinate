export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generatePaperPositionAccountSyncReport } from "@/lib/paper-position-account-sync";

export async function GET() {
  try {
    const report = generatePaperPositionAccountSyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate Paper Position Account Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
