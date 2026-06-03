import { NextResponse } from "next/server";

import {
  ClaudeRiskManager,
} from "@/lib/claude-risk-engine";

export async function GET() {

  const manager =
    new ClaudeRiskManager();

  const risks = [

    manager.assess(
      "XAUUSD",
      3,
      25,
      1,
      "NORMAL"
    ),

    manager.assess(
      "USOIL",
      6,
      35,
      2,
      "NORMAL"
    ),

    manager.assess(
      "EURUSD",
      4,
      20,
      1,
      "NORMAL"
    ),

    manager.assess(
      "BTCUSD",
      8,
      50,
      3,
      "VOLATILE"
    ),
  ];

  return NextResponse.json({
    success: true,
    risks,
    count: risks.length,
    updatedAt: new Date().toISOString(),
  });
}