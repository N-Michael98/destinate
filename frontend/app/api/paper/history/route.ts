export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPaperManager } from "@/lib/paper-trading/paper-singleton";

export async function GET(request: Request) {
  try {
    const broker = new URL(request.url).searchParams.get("broker");
    return NextResponse.json({ ok: true, history: getPaperManager(broker).getHistory() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to load paper trading history", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
