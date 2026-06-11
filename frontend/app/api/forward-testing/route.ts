import { NextResponse } from "next/server";
import { generateForwardTestingReport } from "../../../lib/forward-testing";

export async function GET() {
  const report = generateForwardTestingReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
