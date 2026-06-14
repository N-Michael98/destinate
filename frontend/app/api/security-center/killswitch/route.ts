export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getKillswitchReport, triggerKillswitch, resetKillswitch } from "../../../../lib/killswitch";
import { sendTelegramMessage } from "../../../../lib/telegram-notifications";
import type { KillswitchTrigger } from "../../../../lib/killswitch";

export async function GET() {
  const report = getKillswitchReport();
  return NextResponse.json({ ok: true, report });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action: string = body.action ?? "trigger";

  if (action === "reset") {
    const report = resetKillswitch();
    return NextResponse.json({ ok: true, action: "reset", report });
  }

  const trigger: KillswitchTrigger = body.trigger ?? "MANUAL";
  const triggeredBy: string = body.triggeredBy ?? "Manual UI";

  const report = triggerKillswitch(trigger, triggeredBy);

  await sendTelegramMessage(
    "SECURITY",
    `🚨 KILLSWITCH ACTIVATED\n\nTrigger: ${trigger}\nBy: ${triggeredBy}\nBrokers disconnected: ${report.brokersLoggedOut.join(", ")}\nOrders cancelled: ${report.ordersCancelled}\nSystem locked: ${report.systemLocked}`,
    "CRITICAL",
    "Kill Switch"
  );

  return NextResponse.json({ ok: true, action: "triggered", report });
}
