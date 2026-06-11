import { NextResponse } from "next/server";
import { generateSecurityCenterReport } from "../../../lib/security-center";

export async function GET() {
  const report = generateSecurityCenterReport();
  return NextResponse.json({ ok: true, report });
}
