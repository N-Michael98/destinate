import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    engine: "GPT_ANALYST_ENGINE",
    version: "V9.8.1",
    ready: true,
    message: "GPT Analyst Engine API is running.",
    updatedAt: new Date().toISOString(),
  });
}