import { NextResponse } from "next/server";
import { getDependencyScannerReport } from "../../../lib/dependency-scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = getDependencyScannerReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
