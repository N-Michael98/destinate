export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import {
  TradeTicketBuilder
} from "../../../../lib/execution-preparation";

export async function GET() {

  const tickets = [

    TradeTicketBuilder.build(
      "XAUUSD",
      "BUY",
      3365,
      3345,
      3390,
      3420,
      96,
      true,
      "Consensus BUY"
    ),

    TradeTicketBuilder.build(
      "USOIL",
      "SELL",
      78.40,
      79.20,
      77.00,
      75.50,
      96,
      false,
      "Consensus WAIT"
    ),

    TradeTicketBuilder.build(
      "EURUSD",
      "SELL",
      1.085,
      1.092,
      1.075,
      1.065,
      96,
      false,
      "Consensus WAIT"
    ),

    TradeTicketBuilder.build(
      "BTCUSD",
      "BUY",
      68000,
      67000,
      70000,
      72000,
      96,
      true,
      "Consensus BUY"
    )
  ];

  return NextResponse.json({
    success: true,
    tickets,
    count: tickets.length,
    updatedAt:
      new Date().toISOString()
  });
}