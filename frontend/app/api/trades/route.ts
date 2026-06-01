import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  const trades = await prisma.trade.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    count: trades.length,
    trades,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const trade = await prisma.trade.create({
    data: {
      market: body.market,
      direction: body.direction,
      entry: Number(body.entry),
      stopLoss: Number(body.stopLoss),
      takeProfit: Number(body.takeProfit),
      notes: body.notes ?? "",
    },
  });

  return NextResponse.json({
    success: true,
    trade,
  });
}