import { NextResponse } from "next/server";
import { getSpeciesTradeAllocationReport } from "../../../lib/species-trade-allocation";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesTradeAllocationReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
