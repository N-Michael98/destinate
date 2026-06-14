export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    engine: "CLAUDE_RISK_ENGINE",
    version: "V9.9.1",
    ready: true,
    message: "Claude Risk Engine API is running.",
    updatedAt: new Date().toISOString(),
  });
}