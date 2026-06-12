export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function calculateRiskValues(input: {
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountSize?: number;
  riskPercent?: number;
}) {
  const accountSize = input.accountSize ?? 30000;
  const riskPercent = input.riskPercent ?? 1;

  const riskAmount = (accountSize * riskPercent) / 100;
  const riskPerUnit = Math.abs(input.entry - input.stopLoss);
  const rewardPerUnit = Math.abs(input.takeProfit - input.entry);

  const positionSize =
    riskPerUnit > 0 ? Number((riskAmount / riskPerUnit).toFixed(2)) : 0;

  const riskReward =
    riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 0;

  return {
    accountSize,
    riskPercent,
    riskAmount,
    riskReward,
    positionSize,
  };
}

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
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entry = Number(body.entry);
    const stopLoss = Number(body.stopLoss);
    const takeProfit = Number(body.takeProfit);
    const accountSize = body.accountSize ? Number(body.accountSize) : 30000;
    const riskPercent = body.riskPercent ? Number(body.riskPercent) : 1;

    const riskValues = calculateRiskValues({
      direction: body.direction,
      entry,
      stopLoss,
      takeProfit,
      accountSize,
      riskPercent,
    });

    const trade = await prisma.trade.create({
      data: {
        market: body.market,
        direction: body.direction,
        strategy: body.strategy ?? "Unclassified",
        entry,
        stopLoss,
        takeProfit,
        notes: body.notes ?? "",
        accountSize: riskValues.accountSize,
        riskPercent: riskValues.riskPercent,
        riskAmount: riskValues.riskAmount,
        riskReward: riskValues.riskReward,
        positionSize: riskValues.positionSize,
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
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await prisma.trade.deleteMany();

    return NextResponse.json({
      success: true,
      message: "Alle Trades wurden gelöscht.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Trading Journal konnte nicht zurückgesetzt werden.",
      },
      { status: 500 }
    );
  }
}
