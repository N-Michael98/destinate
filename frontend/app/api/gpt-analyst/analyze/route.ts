import { NextResponse } from "next/server";

import { GPTAnalystManager } from "@/lib/gpt-analyst-engine";

export async function GET() {
  const analyst = new GPTAnalystManager();

  const analyses = [
    analyst.createTradeIdea(
      "XAUUSD",
      3372,
      "TRENDING_BULL",
      "NORMAL",
      "RISK_OFF"
    ),

    analyst.createTradeIdea(
      "USOIL",
      78.4,
      "TRENDING_BEAR",
      "NORMAL",
      "NEUTRAL"
    ),

    analyst.createTradeIdea(
      "EURUSD",
      1.084,
      "TRENDING_BEAR",
      "NORMAL",
      "NEUTRAL"
    ),

    analyst.createTradeIdea(
      "BTCUSD",
      68300,
      "TRENDING_BULL",
      "VOLATILE",
      "RISK_ON"
    ),
  ];

  return NextResponse.json({
    success: true,
    analyses,
    count: analyses.length,
    updatedAt: new Date().toISOString(),
  });
}