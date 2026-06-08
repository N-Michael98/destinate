import { NextResponse } from "next/server";

import {
  generateMutationCompetitionReport,
} from "../../../lib/mutation-competition";

export async function GET() {

  const report =
    generateMutationCompetitionReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
