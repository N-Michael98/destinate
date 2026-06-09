import { NextResponse } from "next/server";
import { buildRegimeAISyncReport } from "@/lib/regime-ai-sync";

export async function GET() {
  try {
    const report = buildRegimeAISyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to build Regime AI Sync report",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
