export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { StrategyLibrary } from "@/lib/ai-agent/strategy-library";

export async function GET() {
  try {
    const strategies = StrategyLibrary.getAll();
    const activeAndWatch = StrategyLibrary.getActiveAndWatch();

    return NextResponse.json({
      ok: true,
      version: "V10.4.3",
      totalStrategies: strategies.length,
      activeAndWatch: activeAndWatch.length,
      strategies,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load strategy library",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}