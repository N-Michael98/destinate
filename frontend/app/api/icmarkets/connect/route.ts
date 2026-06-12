import { NextResponse } from "next/server";
import { icMarketsClient } from "@/lib/icmarkets-connector/icmarkets-client";
import { paperManagerBroker2 } from "@/lib/paper-trading/paper-singleton";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, accountId } = body as Record<string, string>;

    if (!clientId || !clientSecret || !accountId) {
      return NextResponse.json({ ok: false, error: "clientId, clientSecret und accountId sind erforderlich" }, { status: 400 });
    }

    // Credentials in env setzen (Session-basiert)
    process.env.ICMARKETS_CLIENT_ID     = clientId;
    process.env.ICMARKETS_CLIENT_SECRET = clientSecret;
    process.env.ICMARKETS_ACCOUNT_ID    = accountId;

    // Verbindung testen
    const snapshot = await icMarketsClient.getAccountSnapshot();

    if (snapshot.status === "CONNECTED") {
      // Paper Broker 2 mit echtem Balance synchronisieren
      paperManagerBroker2.syncBalance(snapshot.balance, snapshot.currency);
      return NextResponse.json({
        ok: true,
        status: "CONNECTED",
        balance: snapshot.balance,
        currency: snapshot.currency,
        equity: snapshot.equity,
        broker: "IC_MARKETS",
        message: "IC Markets DEMO verbunden — Paper Trading Broker 2 synchronisiert.",
      });
    }

    return NextResponse.json({ ok: false, status: snapshot.status, error: "Verbindung fehlgeschlagen — Credentials prüfen" }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Fehler" }, { status: 500 });
  }
}
