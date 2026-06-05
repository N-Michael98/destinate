import { NextResponse } from "next/server";
import { runPortfolioBrain } from "@/lib/portfolio-brain";

export async function GET() {
  try {
    const report = runPortfolioBrain();

    return NextResponse.json({
      ok: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run portfolio brain",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}