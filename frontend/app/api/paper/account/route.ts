import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    account: {
      mode: "paper",
      currency: "USD",
      startingBalance: 100000,
      balance: 100000,
      equity: 100000,
      usedMargin: 0,
      freeMargin: 100000,
      unrealizedPnL: 0,
      realizedPnL: 0,
    },
  });
}