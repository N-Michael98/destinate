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

  const results = await Promise.all(
    symbols.map((symbol) =>
      cacheGetOrFetch(
        `indicators:${symbol}:${interval}:${period}`,
        async () => {
          try {
            const res = await fetch(
              `${PYTHON_BASE}/api/v1/indicators/${symbol}?interval=${interval}&period=${period}`,
              { cache: "no-store" }
            );
            if (!res.ok) return { symbol, error: `HTTP ${res.status}` };
            return res.json();
          } catch {
            return { symbol, error: "fetch failed" };
          }
        },
        300,
      )
    )
  );

  const successful = results.filter((r: any) => !r?.error);
  return NextResponse.json({
    ok: successful.length > 0, source: "PYTHON_TA", interval, period,
    symbols: results, count: successful.length,
    updatedAt: new Date().toISOString(),
  });
}
