export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { NewsIntelligenceEngine } from "@/lib/news-intelligence/news-intelligence-engine";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      report: NewsIntelligenceEngine.analyze(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to analyze news intelligence",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}