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
      (account as Record<string, unknown>).balance = session.balance;
      (account as Record<string, unknown>).equity = session.balance + ((account as Record<string, unknown>).unrealizedPnL as number ?? 0);
      (account as Record<string, unknown>).currency = session.currency ?? (account as Record<string, unknown>).currency ?? "USD";
    }
  }

  return NextResponse.json({ ok: true, account });
}
