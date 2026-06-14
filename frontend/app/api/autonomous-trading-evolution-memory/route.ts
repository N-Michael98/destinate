export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateAutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";
import {
  buildAutonomousTradingEvolutionMemoryReport,
  saveAutonomousTradingEvolutionMemory,
} from "@/lib/autonomous-trading-evolution-memory";

export async function GET() {
  try {
    const memory = buildAutonomousTradingEvolutionMemoryReport();

    return NextResponse.json({
      ok: true,
      memory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load Autonomous Trading Evolution memory",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const report = generateAutonomousTradingEvolutionReport();
    const memoryEntry = saveAutonomousTradingEvolutionMemory(report);
    const memory = buildAutonomousTradingEvolutionMemoryReport();

    return NextResponse.json({
      ok: true,
      report,
      memoryEntry,
      memory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to save Autonomous Trading Evolution memory",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
