export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";

import {
  generateEvolutionGovernanceReport,
} from "../../../lib/evolution-governance";

export async function GET() {

  const report =
    generateEvolutionGovernanceReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
