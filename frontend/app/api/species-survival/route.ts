import { NextResponse } from "next/server";

import {
  generateSpeciesSurvivalReport,
} from "../../../lib/species-survival";

export async function GET() {

  const report =
    generateSpeciesSurvivalReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
