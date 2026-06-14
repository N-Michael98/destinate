export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { AgentMemory } from "@/lib/ai-agent/memory/agent-memory";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      memory: AgentMemory.getAll(),
      latest: AgentMemory.getLatest(10),
      stats: AgentMemory.getStats(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load AI Agent memory",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}