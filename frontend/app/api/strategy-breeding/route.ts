import { NextResponse } from "next/server";

import {
  generateStrategyBreedingReport,
} from "../../../lib/strategy-breeding";

export async function GET() {

  const report =
    generateStrategyBreedingReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
