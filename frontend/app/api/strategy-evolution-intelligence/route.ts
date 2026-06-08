import { NextResponse } from "next/server";

import {
  generateStrategyEvolutionReport,
} from "../../../lib/strategy-evolution-intelligence";

export async function GET() {

  const report =
    generateStrategyEvolutionReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
