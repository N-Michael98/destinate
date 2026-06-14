export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { executeCapitalDemoOrder, type ExecutionRequest } from "../../../../lib/capital-com/capital-com-execution";
import { isCapitalConnected } from "../../../../lib/capital-com/capital-com-session";

export async function POST(request: Request) {
  try {
    if (!isCapitalConnected()) {
      return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ExecutionRequest>;

    if (!body.symbol || !body.direction || !body.accountBalance) {
      return NextResponse.json({ ok: false, error: "symbol, direction und accountBalance erforderlich" }, { status: 400 });
    }

    const req: ExecutionRequest = {
      symbol: body.symbol,
      direction: body.direction,
      riskPercent: body.riskPercent ?? 1.0,
      accountBalance: body.accountBalance,
      stopLossPips: body.stopLossPips,
      takeProfitPips: body.takeProfitPips,
      confidence: body.confidence ?? 70,
      strategy: body.strategy ?? "UNKNOWN",
      tradingStyle: body.tradingStyle ?? "DAYTRADING",
    };

    const result = await executeCapitalDemoOrder(req);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
