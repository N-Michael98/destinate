import { NextResponse } from "next/server";

const paperOrders: any[] = [];

export async function GET() {
  return NextResponse.json({
    ok: true,
    orders: paperOrders,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const order = {
    id: crypto.randomUUID(),
    symbol: body.symbol,
    side: body.side,
    type: body.type ?? "market",
    quantity: Number(body.quantity),
    price: body.price ? Number(body.price) : null,
    status: "created",
    createdAt: new Date().toISOString(),
  };

  paperOrders.push(order);

  return NextResponse.json({
    ok: true,
    message: "Paper order created",
    order,
  });
}