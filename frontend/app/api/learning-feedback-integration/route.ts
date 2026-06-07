import { NextResponse } from "next/server";
import { getLearningFeedbackIntegrationReport } from "../../../lib/learning-feedback-integration";

export async function GET() {
  const report = getLearningFeedbackIntegrationReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
