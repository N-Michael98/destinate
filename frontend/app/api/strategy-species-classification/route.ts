import { NextResponse } from "next/server";

import {
  generateStrategySpeciesClassificationReport,
} from "../../../lib/strategy-species-classification";

export async function GET() {

  const report =
    generateStrategySpeciesClassificationReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
