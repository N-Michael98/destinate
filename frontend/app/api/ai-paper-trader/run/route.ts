import { NextResponse } from "next/server";
import { AIPaperTrader } from "@/lib/ai-agent/ai-paper-trader";

export async function POST() {
  try {
    const result = AIPaperTrader.run();

    return NextResponse.json({
      ok: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run AI paper trader",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}