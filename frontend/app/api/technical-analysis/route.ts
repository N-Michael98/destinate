import { NextResponse } from "next/server";
import { generateTechnicalAnalysisReport } from "../../../lib/technical-indicators";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");
    const timeframe = searchParams.get("timeframe") ?? "H1";
    const symbols = symbolsParam
      ? symbolsParam.split(",")
      : ["XAUUSD", "EURUSD", "NAS100", "USOIL", "BTCUSD", "SPX500"];
    const report = generateTechnicalAnalysisReport(symbols, timeframe);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Technical analysis error" },
      { status: 500 }
    );
  }
}
