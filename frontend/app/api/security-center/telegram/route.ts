import { NextResponse } from "next/server";
import {
  getTelegramReport,
  configureTelegram,
  updateChannelConfig,
  sendTelegramMessage,
} from "../../../../lib/telegram-notifications";
import type { TelegramChannel, TelegramMessagePriority } from "../../../../lib/telegram-notifications";

export async function GET() {
  const report = getTelegramReport();
  return NextResponse.json({ ok: true, report });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action: string = body.action ?? "";

  if (action === "configure") {
    const { botToken, channels } = body;
    configureTelegram(botToken ?? "", channels ?? []);
    return NextResponse.json({ ok: true, action: "configured" });
  }

  if (action === "update_channel") {
    const { channel, chatId, enabled } = body;
    updateChannelConfig(channel as TelegramChannel, chatId ?? "", !!enabled);
    return NextResponse.json({ ok: true, action: "channel_updated" });
  }

  if (action === "test") {
    const channel: TelegramChannel = body.channel ?? "SYSTEM_HEALTH";
    const priority: TelegramMessagePriority = body.priority ?? "NORMAL";
    const result = await sendTelegramMessage(
      channel,
      `✅ Test message from AI Trading System Security Center.\nChannel: ${channel}\nTime: ${new Date().toLocaleString()}`,
      priority,
      "Security Center Test"
    );
    return NextResponse.json({ ok: result.ok, status: result.status, message: result.message });
  }

  if (action === "send") {
    const channel: TelegramChannel = body.channel ?? "SYSTEM_HEALTH";
    const text: string = body.text ?? "";
    const priority: TelegramMessagePriority = body.priority ?? "NORMAL";
    const source: string = body.source ?? "Security Center";
    const result = await sendTelegramMessage(channel, text, priority, source);
    return NextResponse.json({ ok: result.ok, status: result.status });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
