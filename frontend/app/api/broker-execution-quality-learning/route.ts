export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateBrokerExecutionQualityLearningReport } from "../../../lib/broker-execution-quality-learning";

export async function GET() {
  const report = generateBrokerExecutionQualityLearningReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}
