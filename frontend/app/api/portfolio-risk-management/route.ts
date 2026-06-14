export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { buildPortfolioRiskManagementReport } from "@/lib/portfolio-brain/portfolio-risk-management";

export async function GET() {
  try {
    const portfolioRiskManagement = buildPortfolioRiskManagementReport();

    return NextResponse.json({
      ok: true,
      portfolioRiskManagement,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Risk Management API error",
      },
      { status: 500 }
    );
  }
}