import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runPreCheck, runPostCheck } from "@/lib/agents/validation-agent";

export const runtime = "nodejs";

/**
 * POST /api/validation-agent
 *
 * Body für Pre-Check:
 * { "phase": "pre", "feature": "IP-Blocklist", "plan": "Wir bauen...", "filesToTouch": ["lib/foo.ts"] }
 *
 * Body für Post-Check:
 * { "phase": "post", "feature": "IP-Blocklist", "plan": "Wir bauen..." }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      phase: "pre" | "post";
      plan: string;
      feature?: string;
      filesToTouch?: string[];
    };

    if (!body.phase || !body.plan) {
      return NextResponse.json({ ok: false, error: "phase und plan sind Pflichtfelder" }, { status: 400 });
    }

    if (body.phase === "pre") {
      const result = await runPreCheck({
        plan: body.plan,
        feature: body.feature,
        filesToTouch: body.filesToTouch,
      });
      return NextResponse.json({ ok: true, result });
    }

    if (body.phase === "post") {
      const result = await runPostCheck({
        plan: body.plan,
        feature: body.feature,
      });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ ok: false, error: "phase muss 'pre' oder 'post' sein" }, { status: 400 });
  } catch (err) {
    console.error("[validation-agent] API Fehler:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
