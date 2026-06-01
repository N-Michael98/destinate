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
      where: { id: tradeId },
      data: {
        status: body.status,
        result: body.result,
        profitLoss: Number(body.profitLoss),
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
      { status: 500 }
    );
  }
}