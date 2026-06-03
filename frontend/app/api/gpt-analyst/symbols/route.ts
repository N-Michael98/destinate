import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    symbols: [
      "XAUUSD",
      "USOIL",
      "EURUSD",
      "BTCUSD",
    ],
    count: 4,
  });
}