import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

function calculateRiskValues(input: {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountSize: number;
  riskPercent: number;
}) {
  const riskAmount = (input.accountSize * input.riskPercent) / 100;
  const riskPerUnit = Math.abs(input.entry - input.stopLoss);
  const rewardPerUnit = Math.abs(input.takeProfit - input.entry);

  const positionSize =
    riskPerUnit > 0 ? Number((riskAmount / riskPerUnit).toFixed(2)) : 0;

  const riskReward =
    riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 0;

  return {
    riskAmount,
    riskReward,
    positionSize,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const tradeId = Number(id);

    const existingTrade = await prisma.trade.findUnique({
      where: {
        id: tradeId,
      },
    });

    if (!existingTrade) {
      return NextResponse.json(
        {
          success: false,
          error: "Trade wurde nicht gefunden.",
        },
        {
          status: 404,
        }
      );
    }

    const body = await request.json();

    const nextEntry =
      body.entry !== undefined ? Number(body.entry) : existingTrade.entry;

    const nextStopLoss =
      body.stopLoss !== undefined
        ? Number(body.stopLoss)
        : existingTrade.stopLoss;

    const nextTakeProfit =
      body.takeProfit !== undefined
        ? Number(body.takeProfit)
        : existingTrade.takeProfit;

    const nextAccountSize =
      body.accountSize !== undefined
        ? Number(body.accountSize)
        : existingTrade.accountSize;

    const nextRiskPercent =
      body.riskPercent !== undefined
        ? Number(body.riskPercent)
        : existingTrade.riskPercent;

    const shouldRecalculateRisk =
      body.entry !== undefined ||
      body.stopLoss !== undefined ||
      body.takeProfit !== undefined ||
      body.accountSize !== undefined ||
      body.riskPercent !== undefined;

    const riskValues = shouldRecalculateRisk
      ? calculateRiskValues({
          entry: nextEntry,
          stopLoss: nextStopLoss,
          takeProfit: nextTakeProfit,
          accountSize: nextAccountSize,
          riskPercent: nextRiskPercent,
        })
      : null;

    const updatedTrade = await prisma.trade.update({
      where: {
        id: tradeId,
      },
      data: {
        ...(body.market !== undefined && { market: body.market }),
        ...(body.direction !== undefined && {
          direction: body.direction,
        }),
        ...(body.entry !== undefined && {
          entry: nextEntry,
        }),
        ...(body.stopLoss !== undefined && {
          stopLoss: nextStopLoss,
        }),
        ...(body.takeProfit !== undefined && {
          takeProfit: nextTakeProfit,
        }),
        ...(body.accountSize !== undefined && {
          accountSize: nextAccountSize,
        }),
        ...(body.riskPercent !== undefined && {
          riskPercent: nextRiskPercent,
        }),
        ...(riskValues && {
          riskAmount: riskValues.riskAmount,
          riskReward: riskValues.riskReward,
          positionSize: riskValues.positionSize,
        }),
        ...(body.notes !== undefined && {
          notes: body.notes,
        }),
        ...(body.status !== undefined && {
          status: body.status,
        }),
        ...(body.result !== undefined && {
          result: body.result,
        }),
        ...(body.profitLoss !== undefined && {
          profitLoss: Number(body.profitLoss),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      trade: updatedTrade,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Trade konnte nicht aktualisiert werden.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await prisma.trade.delete({
      where: {
        id: Number(id),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}