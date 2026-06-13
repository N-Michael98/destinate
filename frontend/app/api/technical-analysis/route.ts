export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cacheGetOrFetch } from "@/lib/cache/redis-cache";

const DEFAULT_SYMBOLS = ["EURUSD", "XAUUSD", "BTCUSD", "NAS100", "GBPUSD", "OIL"];

export async function GET(request: Request) {
  const PYTHON_BASE = (process.env["PYTHON_BACKEND_URL"] as string) ?? "http://localhost:8000";
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const interval = searchParams.get("interval") ?? "1h";
  const period = searchParams.get("period") ?? "1mo";
  const symbols = symbolsParam ? symbolsParam.split(",") : DEFAULT_SYMBOLS;

  try {
    const results = await Promise.all(
      symbols.map((symbol) =>
        cacheGetOrFetch(
          `indicators:${symbol}:${interval}:${period}`,
          async () => {
            const res = await fetch(
              `${PYTHON_BASE}/api/v1/indicators/${symbol}?interval=${interval}&period=${period}`,
              { cache: "no-store" }
            );
            if (!res.ok) throw new Error(`Indicators failed for ${symbol}`);
            return res.json();
          },
          300, // 5 Minuten Cache — Indikatoren ändern sich nicht sekündlich
        )
      )
    );

    return NextResponse.json({
      ok: true, source: "PYTHON_TA", interval, period,
      symbols: results, count: results.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false, error: "Python backend offline or error",
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 503 });
  }
}
