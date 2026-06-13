import { NextResponse } from "next/server";
import { cacheGetOrFetch } from "@/lib/cache/redis-cache";

const DEFAULT_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "NAS100", "US30", "OIL"];

export async function GET(request: Request) {
  const PYTHON_BASE = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const symbols = symbolsParam ? symbolsParam.split(",") : DEFAULT_SYMBOLS;
  const cacheKey = `prices:${symbols.join(",")}`;

  try {
    const data = await cacheGetOrFetch(cacheKey, async () => {
      const res = await fetch(`${PYTHON_BASE}/api/v1/market/price/multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Python backend error");
      return res.json();
    }, 15); // 15 Sekunden Cache — Preise bleiben frisch

    return NextResponse.json({
      ok: true,
      prices: (data as { prices: unknown[] }).prices,
      count: (data as { prices: unknown[] }).prices.length,
      source: "PYTHON_YFINANCE",
      cached: true,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    const mockPrices = symbols.map((s) => ({ symbol: s, price: null, error: "Backend offline" }));
    return NextResponse.json({
      ok: false, prices: mockPrices, count: mockPrices.length,
      source: "BACKEND_OFFLINE", updatedAt: new Date().toISOString(),
    });
  }
}
