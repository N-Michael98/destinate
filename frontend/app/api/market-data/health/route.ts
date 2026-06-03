import { NextResponse } from "next/server";
import { marketDataManager } from "@/lib/market-data-engine";

export async function GET() {
  return NextResponse.json({
    success: true,
    health: marketDataManager.getHealth(),
    updatedAt: new Date().toISOString(),
  });
}