import { NextResponse } from "next/server";
import { paperTradingManager } from "@/lib/paper-trading/paper-trading-manager";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const symbol = String(body.symbol ?? "").toUpperCase();
    const price = Number(body.price);

    if (!symbol) {
      return NextResponse.json(
        {
          ok: false,
          error: "Symbol is required",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Valid price is required",
        },
        { status: 400 }
      );
    }

    const result = paperTradingManager.updateMarketPrice(symbol, price);

    return NextResponse.json({
      ok: true,
      message: "Paper market price updated",
      symbol,
      price,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to update paper market price",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}