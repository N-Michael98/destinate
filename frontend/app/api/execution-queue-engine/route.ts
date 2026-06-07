import { NextResponse } from "next/server";
import { buildExecutionQueueEngineReport } from "@/lib/portfolio-brain/execution-queue-engine";

export async function GET() {
  try {
    const executionQueue = buildExecutionQueueEngineReport();

    return NextResponse.json({
      ok: true,
      executionQueue,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Execution Queue Engine API error",
      },
      { status: 500 }
    );
  }
}
