import { NextResponse } from "next/server";
import { getEvolutionAllocationPortfolioSyncReport } from "../../../lib/evolution-allocation-portfolio-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getEvolutionAllocationPortfolioSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
