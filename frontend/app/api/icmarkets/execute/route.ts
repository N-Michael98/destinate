export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { executeICMarketsOrder } from "../../../../lib/icmarkets/icmarkets-execution";
import { isICMarketsConnected, getICMarketsSession } from "../../../../lib/icmarkets/icmarkets-session";

export async function POST(request: Request) {
  try {
    if (!isICMarketsConnected()) {
      return NextResponse.json({ ok: false, error: "IC Markets nicht verbunden" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      symbol?: string;
      direction?: "BUY" | "SELL";
      riskPercent?: number;
      accountBalance?: number;
      stopLossPrice?: number;
      takeProfitPrice?: number;
      confidence?: number;
      tradingStyle?: string;
    };

    if (!body.symbol || !body.direction) {
      return NextResponse.json({ ok: false, error: "symbol und direction erforderlich" }, { status: 400 });
    }

    const session = getICMarketsSession();
    const accountBalance = body.accountBalance ?? session?.balance ?? 10000;

    const result = await executeICMarketsOrder({
      symbol: body.symbol,
      direction: body.direction,
      riskPercent: body.riskPercent ?? 1.0,
      accountBalance,
      stopLossPrice: body.stopLossPrice,
      takeProfitPrice: body.takeProfitPrice,
      confidence: body.confidence ?? 70,
      tradingStyle: body.tradingStyle ?? "DAYTRADING",
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Fehler" }, { status: 500 });
  }
}
