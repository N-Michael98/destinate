import { NextResponse } from "next/server";

import { consensusManager } from "@/lib/consensus-engine";

export async function GET() {
  const decisions = consensusManager.decideMany([
    {
      symbol: "XAUUSD",
      marketDataReady: true,
      regimeTrend: "TRENDING_BULL",
      gptBias: "BULLISH",
      gptConfidence: 80,
      claudeApproved: true,
      claudeRisk: "MEDIUM",
    },

    {
      symbol: "USOIL",
      marketDataReady: true,
      regimeTrend: "TRENDING_BEAR",
      gptBias: "BEARISH",
      gptConfidence: 80,
      claudeApproved: true,
      claudeRisk: "MEDIUM",
    },

    {
      symbol: "EURUSD",
      marketDataReady: true,
      regimeTrend: "TRENDING_BEAR",
      gptBias: "BEARISH",
      gptConfidence: 80,
      claudeApproved: true,
      claudeRisk: "MEDIUM",
    },

    {
      symbol: "BTCUSD",
      marketDataReady: true,
      regimeTrend: "TRENDING_BULL",
      gptBias: "BULLISH",
      gptConfidence: 80,
      claudeApproved: true,
      claudeRisk: "MEDIUM",
    },
  ]);

  return NextResponse.json({
    success: true,
    decisions,
    count: decisions.length,
    updatedAt: new Date().toISOString(),
  });
}