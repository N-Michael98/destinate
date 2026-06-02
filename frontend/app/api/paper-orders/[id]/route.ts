import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const paperOrderId = Number(id);

    const existingPaperOrder = await prisma.paperOrder.findUnique({
      where: {
        id: paperOrderId,
      },
    });

    if (!existingPaperOrder) {
      return NextResponse.json(
        {
          success: false,
          error: "Paper Order wurde nicht gefunden.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updatedPaperOrder = await prisma.paperOrder.update({
      where: {
        id: paperOrderId,
      },
      data: {
        ...(body.market !== undefined && { market: body.market }),
        ...(body.direction !== undefined && { direction: body.direction }),
        ...(body.strategy !== undefined && { strategy: body.strategy }),
        ...(body.entry !== undefined && { entry: Number(body.entry) }),
        ...(body.stopLoss !== undefined && { stopLoss: Number(body.stopLoss) }),
        ...(body.takeProfit !== undefined && {
          takeProfit: Number(body.takeProfit),
        }),
        ...(body.accountSize !== undefined && {
          accountSize: Number(body.accountSize),
        }),
        ...(body.riskPercent !== undefined && {
          riskPercent: Number(body.riskPercent),
        }),
        ...(body.riskAmount !== undefined && {
          riskAmount: Number(body.riskAmount),
        }),
        ...(body.riskReward !== undefined && {
          riskReward: Number(body.riskReward),
        }),
        ...(body.positionSize !== undefined && {
          positionSize: Number(body.positionSize),
        }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.result !== undefined && { result: body.result }),
        ...(body.profitLoss !== undefined && {
          profitLoss: Number(body.profitLoss),
        }),
        ...(body.confidence !== undefined && {
          confidence: Number(body.confidence),
        }),
        ...(body.qualityGrade !== undefined && {
          qualityGrade: body.qualityGrade,
        }),
        ...(body.aiDecision !== undefined && {
          aiDecision: body.aiDecision,
        }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    return NextResponse.json({
      success: true,
      paperOrder: updatedPaperOrder,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Paper Order konnte nicht aktualisiert werden.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await prisma.paperOrder.delete({
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
        error: "Paper Order konnte nicht gelöscht werden.",
      },
      { status: 500 }
    );
  }
}
