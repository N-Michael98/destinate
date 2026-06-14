export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { runPortfolioBrain } from "@/lib/portfolio-brain/brain-manager";
import {
  savePortfolioBrainMemory,
  getPortfolioBrainMemory,
} from "@/lib/portfolio-brain/portfolio-brain-memory";

export async function GET() {
  try {
    const report = runPortfolioBrain();

    const memoryEntry = savePortfolioBrainMemory(report);
    const memory = getPortfolioBrainMemory();

    return NextResponse.json({
      ok: true,
      report,
      memoryEntry,
      memory,
      memoryCount: memory.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain API error",
      },
      { status: 500 }
    );
  }
}
