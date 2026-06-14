export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { buildTradeApprovalEngineReport } from "@/lib/portfolio-brain/trade-approval-engine";

export async function GET() {
  try {
    const tradeApproval = buildTradeApprovalEngineReport();

    return NextResponse.json({
      ok: true,
      tradeApproval,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Trade Approval Engine API error",
      },
      { status: 500 }
    );
  }
}