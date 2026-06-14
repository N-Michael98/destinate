export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getInstitutionalPortfolioBrainSyncReport } from "../../../lib/institutional-portfolio-brain-sync";

export async function GET() {
  const report = getInstitutionalPortfolioBrainSyncReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
