export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPaperManager } from "@/lib/paper-trading/paper-singleton";
import { getCapitalSession, isCapitalConnected } from "@/lib/capital-com/capital-com-session";

export async function GET(request: Request) {
  const broker = new URL(request.url).searchParams.get("broker") ?? "capital";
  const account = getPaperManager(broker).getAccount();

  // Sync Capital.com broker balance from live session
  if (broker === "capital" && isCapitalConnected()) {
    const session = getCapitalSession();
    if (session && session.balance > 0) {
      account.balance = session.balance;
      account.equity = session.balance + (account.unrealizedPnL ?? 0);
      account.currency = session.currency ?? account.currency ?? "USD";
      account.accountType = session.accountType ?? "DEMO";
      account.broker = "Capital.com DEMO";
    }
  }

  return NextResponse.json({ ok: true, account });
}
