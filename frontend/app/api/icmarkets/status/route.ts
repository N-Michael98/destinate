export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getICMarketsSession, isICMarketsConnected } from "@/lib/icmarkets/icmarkets-session";
import { isICMarketsConfigured } from "@/lib/icmarkets/icmarkets-client";

export async function GET() {
  try {
    const session = getICMarketsSession();
    const configured = isICMarketsConfigured();

    if (!configured) {
      return NextResponse.json({
        success: true,
        broker: "IC_MARKETS",
        connected: false,
        status: "NOT_CONFIGURED",
        message: "ICMARKETS_MCP_TOKEN nicht gesetzt — bitte in Railway Environment Variables konfigurieren.",
      });
    }

    if (!isICMarketsConnected() || !session) {
      return NextResponse.json({
        success: true,
        broker: "IC_MARKETS",
        connected: false,
        status: "DISCONNECTED",
        message: "MCP Token konfiguriert — bitte Connect klicken.",
      });
    }

    return NextResponse.json({
      success: true,
      broker: "IC_MARKETS",
      connected: true,
      status: "CONNECTED",
      accountId: session.accountId,
      balance: session.balance,
      equity: session.equity,
      currency: session.currency,
      leverage: session.leverage,
      connectedAt: session.connectedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, broker: "IC_MARKETS", error: error instanceof Error ? error.message : "Fehler" },
      { status: 500 }
    );
  }
}
