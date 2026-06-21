export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateStrategyEvolutionReport } from "../../../lib/strategy-evolution-intelligence";
import { generateLiveEvolutionScores } from "../../../lib/strategy-evolution/evolution-engine";

export async function GET() {
  try {
    // Python backend optional — graceful fallback if not deployed
    const liveScores = await Promise.race([
      generateLiveEvolutionScores(),
      new Promise<[]>((resolve) => setTimeout(() => resolve([]), 5000)),
    ]);

    const report = generateStrategyEvolutionReport();

    return NextResponse.json({
      ok: true,
      report,
      liveEvolutionScores: liveScores,
      source: liveScores.length > 0 ? "PYTHON_BACKTEST" : "MOCK",
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: true,
      report: generateStrategyEvolutionReport(),
      liveEvolutionScores: [],
      source: "MOCK",
      error: err instanceof Error ? err.message : String(err),
      updatedAt: new Date().toISOString(),
    });
  }
}
