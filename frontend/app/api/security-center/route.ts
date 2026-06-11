import { NextResponse } from "next/server";
import { generateSecurityCenterReport } from "../../../lib/security-center";

export async function GET() {
  try {
    const report = generateSecurityCenterReport();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Security center error" },
      { status: 500 }
    );
  }
}
