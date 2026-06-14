export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import {
  generateSpeciesExtinctionReport,
} from "../../../lib/species-extinction";

export async function GET() {

  const report =
    generateSpeciesExtinctionReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
