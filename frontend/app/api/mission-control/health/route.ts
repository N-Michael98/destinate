import { NextResponse } from "next/server";
import { scanMissionControlEndpoints } from "@/lib/mission-control/health-scanner";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const report = await scanMissionControlEndpoints(baseUrl);

  return NextResponse.json(report);
}
