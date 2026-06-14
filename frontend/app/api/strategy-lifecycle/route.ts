export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateStrategyLifecycleReport }
from "../../../lib/strategy-lifecycle";

export async function GET() {

  const report =
    generateStrategyLifecycleReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
