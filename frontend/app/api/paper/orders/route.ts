import { NextResponse } from "next/server";
import { getPaperManager } from "@/lib/paper-trading/paper-singleton";
import { PaperDirection } from "@/lib/paper-trading/paper-types";

export async function GET(request: Request) {
  const broker = new URL(request.url).searchParams.get("broker");
  return NextResponse.json({ ok: true, orders: getPaperManager(broker).getOrders() });
}

export async function POST(request: Request) {
  try {
    const broker = new URL(request.url).searchParams.get("broker");
    const body = await request.json();
    const result = getPaperManager(broker).createAndFillPaperOrder(
      body.symbol,
      body.direction as PaperDirection,
      Number(body.entry),
      Number(body.stopLoss),
      Number(body.takeProfit1),
      Number(body.takeProfit2),
      Number(body.confidence),
      body.reason ?? "Manual paper order",
      Number(body.size ?? 1)
    );
    return NextResponse.json({ ok: true, message: "Paper order created and filled", result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to create paper order", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
