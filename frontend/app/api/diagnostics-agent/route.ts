export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initDiagnosticsAgent, getDiagnosticsReport, clearAnomalies } from "@/lib/agents/diagnostics-agent";

// Initialisiere beim ersten Request automatisch
initDiagnosticsAgent();

export async function GET() {
  const report = getDiagnosticsReport();
  return NextResponse.json({ ok: true, ...report });
}

export async function DELETE() {
  clearAnomalies();
  return NextResponse.json({ ok: true, message: "Anomalien zurückgesetzt" });
}
