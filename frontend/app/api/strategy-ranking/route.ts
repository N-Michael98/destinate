export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateStrategyRankingReport } from "../../../lib/strategy-ranking";

export async function GET() {
  const report = generateStrategyRankingReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
