import { NextResponse } from "next/server";
import { buildPortfolioBrainSelfEvolutionReport } from "@/lib/portfolio-brain/portfolio-brain-self-evolution";

export async function GET() {
  try {
    const selfEvolution = buildPortfolioBrainSelfEvolutionReport();

    return NextResponse.json({
      ok: true,
      selfEvolution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Portfolio Brain Self Evolution API error",
      },
      { status: 500 }
    );
  }
}