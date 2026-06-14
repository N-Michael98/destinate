export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateBrokerEvolutionIntelligenceReport } from "../../../lib/broker-evolution-intelligence";

export async function GET() {
  const report = generateBrokerEvolutionIntelligenceReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
