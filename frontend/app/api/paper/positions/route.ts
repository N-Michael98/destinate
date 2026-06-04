import { NextResponse } from "next/server";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";

export async function GET() {
  return NextResponse.json({
    ok: true,
    positions: paperTradingManager.getPositions(),
  });
}