export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { MarketRegimeEngine }
  from "@/lib/ai-agent/market-regime-engine";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      regime:
        MarketRegimeEngine.analyze(),
      timestamp:
        new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}