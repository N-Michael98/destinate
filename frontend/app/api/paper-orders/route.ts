export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function calculatePaperRiskValues(input: {
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
    const paperOrders = await prisma.paperOrder.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      count: paperOrders.length,
      paperOrders,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Paper Orders konnten nicht geladen werden.",
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

    const riskValues = calculatePaperRiskValues({
      entry,
      stopLoss,
      takeProfit,
      accountSize,
      riskPercent,
    });

    const paperOrder = await prisma.paperOrder.create({
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
        confidence: body.confidence ? Number(body.confidence) : 0,
        qualityGrade: body.qualityGrade ?? "B",
        aiDecision: body.aiDecision ?? "WAIT",
      },
    });

    return NextResponse.json({
      success: true,
      paperOrder,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Paper Order konnte nicht gespeichert werden.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await prisma.paperOrder.deleteMany();

    return NextResponse.json({
      success: true,
      message: "Alle Paper Orders wurden gelöscht.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Paper Orders konnten nicht gelöscht werden.",
      },
      { status: 500 }
    );
  }
}
