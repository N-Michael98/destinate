export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { clearICMarketsSession } from "@/lib/icmarkets/icmarkets-session";
import { updateBrokerConnection } from "@/lib/settings/settings-store";

export async function POST() {
  await clearICMarketsSession();
  await updateBrokerConnection({ brokerKey: "IC_MARKETS", connected: false, error: null }).catch(() => {});
  return NextResponse.json({ ok: true, message: "IC Markets getrennt und Session aus Redis gelöscht." });
}
