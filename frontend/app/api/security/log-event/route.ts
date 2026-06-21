export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { logSecurityEvent, type SecurityEvent } from "@/lib/security-watchdog/security-event-logger";

export async function POST(request: Request) {
  try {
    const event = await request.json() as SecurityEvent;
    await logSecurityEvent(event);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
