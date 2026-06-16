export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    symbols: ["XAUUSD", "EURUSD", "BTCUSD", "NAS100", "USOIL", "GBPUSD", "SPX500", "SILVER"],
    count: 8,
  });
}
