import { NextResponse } from "next/server";
import { runLearningCycle } from "@/lib/learning/trade-feedback-engine";

export async function POST() {
  const report = await runLearningCycle();
  return NextResponse.json({ ok: true, report });
}

export async function GET() {
  const report = await runLearningCycle();
  return NextResponse.json({ ok: true, report });
}
