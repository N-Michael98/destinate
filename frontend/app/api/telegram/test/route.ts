export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sendTelegram, isTelegramConfigured } from "@/lib/telegram-notifications/telegram-sender";

export async function POST() {
  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN oder TELEGRAM_CHAT_ID fehlt in Railway" });
  }
  const ok = await sendTelegram(
`✅ <b>Destinate Trading Bot verbunden!</b>

🤖 AI Trading System läuft
📊 Capital.com + IC Markets aktiv
🕐 ${new Date().toLocaleString("de-CH")}

Ich benachrichtige dich bei:
• 📈 Trade ausgeführt
• ✅/❌ Trade geschlossen
• ⚡ Breakeven gesetzt
• 📊 Tages-Zusammenfassung`
  );
  return NextResponse.json({ ok, message: ok ? "Test-Nachricht gesendet!" : "Fehler beim Senden" });
}
