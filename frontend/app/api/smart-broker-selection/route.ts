import { NextResponse } from "next/server";
import {
  generateSmartBrokerSelectionReport,
  TradingStyle,
} from "../../../lib/smart-broker-selection";

function normalizeTradingStyle(value: string | null): TradingStyle {
  if (value === "SWING" || value === "DAYTRADING" || value === "SCALPING") {
    return value;
  }

  return "SCALPING";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tradingStyle = normalizeTradingStyle(searchParams.get("style"));

  const report = generateSmartBrokerSelectionReport(tradingStyle);

  return NextResponse.json({
    ok: true,
    report,
  });
}