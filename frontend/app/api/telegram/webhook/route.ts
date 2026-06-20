export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram-notifications/telegram-sender";
import { triggerKillswitch, resetKillswitch, getKillswitchReport } from "@/lib/killswitch";

const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { first_name?: string };
    text?: string;
  };
}

async function reply(chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

export async function POST(request: Request) {
  try {
    const update = await request.json() as TelegramUpdate;
    const message = update.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const text = (message.text ?? "").trim().toLowerCase();
    const name = message.from?.first_name ?? "User";

    // Security: only respond to authorized chat
    if (String(chatId) !== ALLOWED_CHAT_ID) {
      console.warn(`[telegram-webhook] Unauthorized access attempt from chat ${chatId}`);
      await reply(chatId, "⛔ Nicht autorisiert.");
      return NextResponse.json({ ok: true });
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    if (text === "/killswitch" || text === "/ks") {
      const report = triggerKillswitch("MANUAL", `Telegram: ${name}`);
      await sendTelegram(
`🚨 <b>KILL SWITCH AKTIVIERT</b>

Ausgelöst von: ${name} via Telegram
Broker getrennt: ${report.brokersLoggedOut.join(", ") || "alle"}
Orders abgebrochen: ${report.ordersCancelled}
System gesperrt: ${report.systemLocked ? "JA" : "NEIN"}
🕐 ${new Date().toLocaleString("de-CH")}`
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/reset" || text === "/killswitch reset") {
      const ks = getKillswitchReport();
      if (!ks.triggered) {
        await reply(chatId, "ℹ️ Kill Switch ist nicht aktiv — kein Reset nötig.");
        return NextResponse.json({ ok: true });
      }
      resetKillswitch();
      await sendTelegram(
`✅ <b>Kill Switch zurückgesetzt</b>

System wieder aktiv.
Reset durch: ${name} via Telegram
🕐 ${new Date().toLocaleString("de-CH")}`
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/status") {
      const ks = getKillswitchReport();
      const statusEmoji = ks.triggered ? "🔴" : "🟢";
      await reply(chatId,
`${statusEmoji} <b>System Status</b>

Kill Switch: ${ks.triggered ? "AKTIV 🚨" : "Armed ✅"}
🕐 ${new Date().toLocaleString("de-CH")}

Befehle:
/killswitch — Kill Switch aktivieren
/reset — Kill Switch zurücksetzen
/status — System Status
/help — Alle Befehle`
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/help") {
      await reply(chatId,
`🤖 <b>Destinate Trading Bot</b>

<b>Sicherheits-Befehle:</b>
/killswitch — Alle Positionen schliessen, System sperren
/ks — Kurzform für /killswitch
/reset — Kill Switch zurücksetzen
/status — Aktueller System Status
/help — Diese Hilfe`
      );
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    if (text.startsWith("/")) {
      await reply(chatId, `❓ Unbekannter Befehl: ${text}\n\nSchreibe /help für alle Befehle.`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram-webhook] Error:", err);
    return NextResponse.json({ ok: true }); // always return 200 to Telegram
  }
}
