import { NextResponse } from "next/server";
import { StrategyEvolutionEngine } from "@/lib/ai-agent/strategy-evolution";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      strategy: StrategyEvolutionEngine.analyze(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to analyze AI strategy evolution",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}