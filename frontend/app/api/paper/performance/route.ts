import { NextResponse } from "next/server";
import { PaperPerformance } from "@/lib/paper-trading/paper-performance";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      performance: PaperPerformance.calculate(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to calculate paper performance",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}