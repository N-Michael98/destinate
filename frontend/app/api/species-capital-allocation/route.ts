import { NextResponse } from "next/server";
import { getSpeciesCapitalAllocationReport } from "../../../lib/species-capital-allocation";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesCapitalAllocationReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
