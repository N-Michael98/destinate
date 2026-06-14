export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    engine: "MARKET_REGIME_ENGINE",
    version: "V9.7.1",
    ready: true,
    message: "Market Regime Engine API is running.",
    updatedAt: new Date().toISOString(),
  });
}