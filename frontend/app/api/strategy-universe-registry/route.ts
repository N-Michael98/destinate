import { NextResponse } from "next/server";
import { generateStrategyUniverseRegistryReport } from "../../../lib/strategy-universe-registry";

export async function GET() {
  const report = generateStrategyUniverseRegistryReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
