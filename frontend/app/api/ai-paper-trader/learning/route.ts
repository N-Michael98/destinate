import { NextResponse } from "next/server";
import { AILearningEngine } from "@/lib/ai-agent/learning-engine";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      learning: AILearningEngine.analyze(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to analyze AI Agent learning",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}