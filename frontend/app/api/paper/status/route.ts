export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { paperTradingManager } from "@/lib/paper-trading/paper-singleton";

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "online",
    paperTrading: !!paperTradingManager,
    timestamp: new Date().toISOString(),
  });
}