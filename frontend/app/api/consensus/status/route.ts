import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    engine: "CONSENSUS_ENGINE",
    version: "V10.0.1",
    ready: true,
    message: "Consensus Engine API is running.",
    updatedAt: new Date().toISOString(),
  });
}