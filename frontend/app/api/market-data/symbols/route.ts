export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { SYMBOL_REGISTRY } from "@/lib/market-data-engine";

export async function GET() {
  return NextResponse.json({
    success: true,
    symbols: SYMBOL_REGISTRY,
    count: Object.keys(SYMBOL_REGISTRY).length,
  });
}