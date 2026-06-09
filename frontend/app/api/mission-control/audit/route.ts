import { NextResponse } from "next/server";
import { runMissionControlAudit } from "@/lib/mission-control/system-audit";

export async function GET() {
  return NextResponse.json(runMissionControlAudit());
}
