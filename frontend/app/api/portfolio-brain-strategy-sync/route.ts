import { NextResponse } from "next/server";
import { buildPortfolioBrainStrategySyncReport } from "@/lib/portfolio-brain/portfolio-brain-strategy-sync";

export async function GET() {
  try {
    const report = buildPortfolioBrainStrategySyncReport();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Strategy Sync error",
      },
      { status: 500 }
    );
  }
}