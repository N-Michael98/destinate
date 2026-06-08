import { NextResponse } from "next/server";
import { getSpeciesPositionSizingReport } from "../../../lib/species-position-sizing";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getSpeciesPositionSizingReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
