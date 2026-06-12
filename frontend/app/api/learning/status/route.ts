import { NextResponse } from "next/server";
import { getLearningState } from "@/lib/learning/trade-feedback-engine";

export async function GET() {
  const state = getLearningState();
  return NextResponse.json({ ok: true, state });
}
