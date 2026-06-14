export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateMultiStrategyCompetitionReport } from "../../../lib/multi-strategy-competition";

export async function GET() {
  const report = generateMultiStrategyCompetitionReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
