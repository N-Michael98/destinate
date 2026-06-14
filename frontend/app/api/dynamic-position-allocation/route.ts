export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateDynamicPositionAllocationReport } from "../../../lib/dynamic-position-allocation";

export async function GET() {
  const report = generateDynamicPositionAllocationReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
