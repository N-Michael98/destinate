export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPaperManager } from "@/lib/paper-trading/paper-singleton";
import { runLearningCycle } from "@/lib/learning/trade-feedback-engine";

export async function POST(request: Request) {
  try {
    const broker = new URL(request.url).searchParams.get("broker");
    const body = await request.json();
    const symbol = String(body.symbol ?? "").toUpperCase();
    const price = Number(body.price);

    if (!symbol) return NextResponse.json({ ok: false, error: "Symbol is required" }, { status: 400 });
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, error: "Valid price is required" }, { status: 400 });

    const manager = getPaperManager(broker);
    const before = manager.getPositions().filter(p => p.status === "OPEN").length;
    const result = manager.updateMarketPrice(symbol, price);
    const after = manager.getPositions().filter(p => p.status === "OPEN").length;

    // Lern-Zyklus triggern wenn eine Position geschlossen wurde
    if (after < before) {
      runLearningCycle().catch(() => {});
    }

    return NextResponse.json({ ok: true, message: "Paper market price updated", symbol, price, result, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to update paper market price", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
