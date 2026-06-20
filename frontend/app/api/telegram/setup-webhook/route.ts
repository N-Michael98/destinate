export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN nicht gesetzt" });
  }

  const { appUrl } = await request.json().catch(() => ({}));
  if (!appUrl) {
    return NextResponse.json({ ok: false, error: "appUrl fehlt" });
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });

  const data = await res.json();
  return NextResponse.json({ ok: data.ok, description: data.description, webhookUrl });
}

export async function GET() {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN nicht gesetzt" });
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const data = await res.json();
  return NextResponse.json({ ok: true, info: data.result });
}
