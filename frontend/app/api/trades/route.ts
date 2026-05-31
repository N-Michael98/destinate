import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      count: trades.length,
      trades,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Trades konnten nicht geladen werden.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Trade konnte nicht gespeichert werden.",
      },
      {
        status: 500,
      }
    );
  }
}