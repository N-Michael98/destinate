export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  buildPortfolioBrainDecisionMemoryReport,
  savePortfolioBrainDecisionMemory,
} from "@/lib/portfolio-brain/portfolio-brain-decision-memory";

export async function GET() {
  try {
    const memory = buildPortfolioBrainDecisionMemoryReport();

    return NextResponse.json({
      ok: true,
      memory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Decision Memory API error",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const memory = savePortfolioBrainDecisionMemory();

    return NextResponse.json({
      ok: true,
      memory,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Decision Memory Save API error",
      },
      { status: 500 }
    );
  }
}