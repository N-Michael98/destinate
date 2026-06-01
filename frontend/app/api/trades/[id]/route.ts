import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const tradeId = Number(id);

    const body = await request.json();

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
          entry: Number(body.entry),
        }),
        ...(body.stopLoss !== undefined && {
          stopLoss: Number(body.stopLoss),
        }),
        ...(body.takeProfit !== undefined && {
          takeProfit: Number(body.takeProfit),
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