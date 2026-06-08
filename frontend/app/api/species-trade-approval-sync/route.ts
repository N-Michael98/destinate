import { NextResponse } from "next/server";
import { getSpeciesTradeApprovalSyncReport } from "../../../lib/species-trade-approval-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesTradeApprovalSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
