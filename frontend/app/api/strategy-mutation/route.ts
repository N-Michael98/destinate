export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import {
  generateStrategyMutationReport,
} from "../../../lib/strategy-mutation";

export async function GET() {

  const report =
    generateStrategyMutationReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
