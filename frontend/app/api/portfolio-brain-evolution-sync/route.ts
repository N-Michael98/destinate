import { NextResponse } from "next/server";

import {
  generatePortfolioBrainEvolutionSyncReport,
} from "../../../lib/portfolio-brain-evolution-sync";

export async function GET() {
  const report = generatePortfolioBrainEvolutionSyncReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
