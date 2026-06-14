export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateStrategyEvolutionReport } from "../../../lib/strategy-evolution-intelligence";
import { generateLiveEvolutionScores } from "../../../lib/strategy-evolution/evolution-engine";

export async function GET() {
  // Echte Backtesting-Scores von Python laden
  const liveScores = await generateLiveEvolutionScores();

  const report = generateStrategyEvolutionReport();

  return NextResponse.json({
    ok: true,
    report,
    liveEvolutionScores: liveScores,
    source: liveScores.length > 0 ? "PYTHON_BACKTEST" : "MOCK",
    updatedAt: new Date().toISOString(),
  });
}
