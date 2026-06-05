import { NextResponse } from "next/server";
import { getMarketUniverse } from "@/lib/market-universe/market-universe";

export async function GET() {
  try {
    const universe = getMarketUniverse();

    return NextResponse.json({
      ok: true,
      universe,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Market Universe API error",
      },
      { status: 500 }
    );
  }
}