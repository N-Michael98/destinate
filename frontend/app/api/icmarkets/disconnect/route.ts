export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { clearICMarketsSession } from "@/lib/icmarkets/icmarkets-session";

export async function POST() {
  await clearICMarketsSession();
  return NextResponse.json({ ok: true, message: "IC Markets getrennt und Session aus Redis gelöscht." });
}
