export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getBankInstitutionalIntelligenceReport } from "../../../lib/bank-institutional-intelligence";

export async function GET() {
  const report = getBankInstitutionalIntelligenceReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
