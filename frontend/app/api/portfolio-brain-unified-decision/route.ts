import { NextResponse } from "next/server";
import { getPortfolioBrainUnifiedDecisionReport } from "../../../lib/portfolio-brain-unified-decision";

export async function GET() {
  const report = getPortfolioBrainUnifiedDecisionReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
