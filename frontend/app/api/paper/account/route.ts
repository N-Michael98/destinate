export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPaperManager } from "@/lib/paper-trading/paper-singleton";

export async function GET(request: Request) {
  const broker = new URL(request.url).searchParams.get("broker");
  return NextResponse.json({ ok: true, account: getPaperManager(broker).getAccount() });
}
