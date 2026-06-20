export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { icGetAccount, isICMarketsConfigured } from "@/lib/icmarkets/icmarkets-client";
import { setICMarketsSession } from "@/lib/icmarkets/icmarkets-session";
import { paperManagerBroker2 } from "@/lib/paper-trading/paper-singleton";

export async function POST() {
  try {
    if (!isICMarketsConfigured()) {
      return NextResponse.json(
        { ok: false, error: "ICMARKETS_MCP_TOKEN ist nicht konfiguriert — bitte in Railway Environment Variables setzen" },
        { status: 400 }
      );
    }

    const account = await icGetAccount();

    if (!account.ok) {
      return NextResponse.json(
        { ok: false, error: account.error ?? "MCP-Verbindung fehlgeschlagen" },
        { status: 401 }
      );
    }

    const leverage = Number(process.env.ICMARKETS_LEVERAGE ?? 500);

    setICMarketsSession({
      accountId: account.accountId ?? "",
      balance: account.balance ?? 0,
      equity: account.equity ?? 0,
      currency: account.currency ?? "CHF",
      connectedAt: new Date().toISOString(),
      leverage,
    });

    paperManagerBroker2.syncBalance(account.balance ?? 0, account.currency ?? "CHF");

    return NextResponse.json({
      ok: true,
      status: "CONNECTED",
      balance: account.balance,
      equity: account.equity,
      currency: account.currency,
      accountId: account.accountId,
      leverage,
      broker: "IC_MARKETS",
      message: "IC Markets cTrader verbunden via MCP Token.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Fehler" }, { status: 500 });
  }
}
