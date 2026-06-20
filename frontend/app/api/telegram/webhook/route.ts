export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram-notifications/telegram-sender";
import { triggerKillswitch, resetKillswitch, getKillswitchReport } from "@/lib/killswitch";

const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const KILLSWITCH_PASSWORD = process.env.KILLSWITCH_PASSWORD ?? "";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { first_name?: string };
    text?: string;
  };
}

// Pending password confirmations: chatId → { action, expiresAt }
const pendingConfirm = new Map<number, { action: string; expiresAt: number }>();

async function reply(chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

async function executeFullShutdown(name: string): Promise<string[]> {
  const log: string[] = [];

  // Stage 1: Close all Capital.com positions
  try {
    const { isCapitalConnected, getCapitalSession } = await import("@/lib/capital-com/capital-com-session");
    const { capitalGetPositions, capitalClosePosition } = await import("@/lib/capital-com/capital-com-client");
    if (isCapitalConnected()) {
      const session = getCapitalSession()!;
      const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
      if (posResult.ok && posResult.positions?.length) {
        for (const pos of posResult.positions) {
          await capitalClosePosition(session.apiKey, session.cst, session.securityToken, pos.dealId).catch(() => {});
        }
        log.push(`Capital.com: ${posResult.positions.length} Positionen geschlossen`);
      } else {
        log.push("Capital.com: Keine offenen Positionen");
      }
    }
  } catch (e) {
    log.push(`Capital.com: Fehler — ${e instanceof Error ? e.message : String(e)}`);
  }

  // Stage 2: Close all IC Markets positions
  try {
    const { isICMarketsConnected } = await import("@/lib/icmarkets/icmarkets-session");
    const { icGetPositions, icClosePosition } = await import("@/lib/icmarkets/icmarkets-client");
    if (isICMarketsConnected()) {
      const posResult = await icGetPositions();
      if (posResult.ok && Array.isArray(posResult.positions) && posResult.positions.length > 0) {
        for (const pos of posResult.positions as Array<{ positionId: string }>) {
          await icClosePosition(pos.positionId).catch(() => {});
        }
        log.push(`IC Markets: ${(posResult.positions as unknown[]).length} Positionen geschlossen`);
      } else {
        log.push("IC Markets: Keine offenen Positionen");
      }
    }
  } catch (e) {
    log.push(`IC Markets: Fehler — ${e instanceof Error ? e.message : String(e)}`);
  }

  // Stage 3: Disconnect both brokers
  try {
    const { disconnectCapital } = await import("@/lib/capital-com/capital-com-session");
    await disconnectCapital();
    log.push("Capital.com: Session getrennt");
  } catch { /* non-fatal */ }

  try {
    const { clearICMarketsSession } = await import("@/lib/icmarkets/icmarkets-session");
    await clearICMarketsSession();
    log.push("IC Markets: Session getrennt (Redis gelöscht)");
  } catch { /* non-fatal */ }

  // Stage 4: Update broker connections in settings store
  try {
    const { updateBrokerConnection } = await import("@/lib/settings/settings-store");
    await updateBrokerConnection({ brokerKey: "CAPITAL_COM", connected: false });
    await updateBrokerConnection({ brokerKey: "IC_MARKETS", connected: false });
    log.push("Broker-Status: DISCONNECTED");
  } catch { /* non-fatal */ }

  // Stage 5: Trigger system killswitch (locks execution)
  triggerKillswitch("MANUAL", `Telegram Admin: ${name}`);
  log.push("System: LOCKDOWN aktiv — alle Ausführungen blockiert");

  return log;
}

async function executeFullRestart(name: string): Promise<string[]> {
  const log: string[] = [];

  // Step 1: Reset killswitch lock
  resetKillswitch();
  log.push("Kill Switch: zurückgesetzt");

  // Step 2: Reconnect IC Markets (token is in Redis)
  try {
    const { restoreICMarketsSessionFromRedis, getICMarketsSession } = await import("@/lib/icmarkets/icmarkets-session");
    const restored = await restoreICMarketsSessionFromRedis();
    if (restored) {
      const { updateBrokerConnection } = await import("@/lib/settings/settings-store");
      const sess = getICMarketsSession();
      await updateBrokerConnection({ brokerKey: "IC_MARKETS", connected: true, accountId: sess?.accountId ?? "IC-MCP", accountMode: "DEMO" });
      log.push("IC Markets: Verbunden (Token aus Redis wiederhergestellt)");
    } else {
      log.push("IC Markets: Token nicht in Redis — bitte manuell verbinden");
    }
  } catch (e) {
    log.push(`IC Markets: Fehler — ${e instanceof Error ? e.message : String(e)}`);
  }

  // Step 3: Reconnect Capital.com (credentials saved in DB)
  try {
    const { autoReconnectCapital } = await import("@/lib/capital-com/capital-com-session");
    const result = await autoReconnectCapital();
    if (result.ok) {
      log.push("Capital.com: Verbunden (gespeicherte Zugangsdaten)");
    } else {
      log.push(`Capital.com: Reconnect fehlgeschlagen — ${result.error ?? "unbekannt"}`);
    }
  } catch (e) {
    log.push(`Capital.com: Fehler — ${e instanceof Error ? e.message : String(e)}`);
  }

  log.push(`Reaktiviert von: ${name} via Telegram`);
  return log;
}

export async function POST(request: Request) {
  try {
    const update = await request.json() as TelegramUpdate;
    const message = update.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const text = (message.text ?? "").trim();
    const textLower = text.toLowerCase();
    const name = message.from?.first_name ?? "Admin";

    // Security: only respond to authorized chat
    if (String(chatId) !== ALLOWED_CHAT_ID) {
      console.warn(`[telegram-webhook] Unauthorized attempt from chat ${chatId}`);
      await sendTelegram(
`⚠️ <b>Nicht autorisierter Zugriff</b>

Jemand hat versucht, den Bot zu bedienen.
Chat-ID: <code>${chatId}</code>
Text: <code>${text.slice(0, 50)}</code>
🕐 ${new Date().toLocaleString("de-CH")}`
      );
      await reply(chatId, "⛔ Nicht autorisiert. Dieser Vorfall wurde gemeldet.");
      return NextResponse.json({ ok: true });
    }

    // ── Password confirmation flow ─────────────────────────────────────────────
    const pending = pendingConfirm.get(chatId);
    if (pending) {
      // Clean up expired
      if (Date.now() > pending.expiresAt) {
        pendingConfirm.delete(chatId);
        await reply(chatId, "⏱ Timeout — Bestätigung abgelaufen. Bitte Befehl erneut senden.");
        return NextResponse.json({ ok: true });
      }

      // Check password
      if (!KILLSWITCH_PASSWORD) {
        await reply(chatId, "⚠️ KILLSWITCH_PASSWORD nicht in Railway gesetzt. Bitte zuerst konfigurieren.");
        pendingConfirm.delete(chatId);
        return NextResponse.json({ ok: true });
      }

      if (text !== KILLSWITCH_PASSWORD) {
        pendingConfirm.delete(chatId);
        await sendTelegram(
`🚨 <b>Falsches Admin-Passwort!</b>

Jemand hat versucht, den Kill Switch mit falschem Passwort auszulösen.
Eingabe: <code>${text.slice(0, 20)}***</code>
🕐 ${new Date().toLocaleString("de-CH")}`
        );
        await reply(chatId, "❌ Falsches Passwort. Kill Switch verweigert. Sicherheitsalert gesendet.");
        return NextResponse.json({ ok: true });
      }

      pendingConfirm.delete(chatId);

      if (pending.action === "reset") {
        // Execute full system restart
        await reply(chatId, "🔄 Passwort korrekt. Starte System neu...");
        const log = await executeFullRestart(name);
        await sendTelegram(
`✅ <b>SYSTEM REAKTIVIERT</b>

Reaktiviert von: ${name} (Admin via Telegram)

<b>Ausgeführt:</b>
${log.map(l => `• ${l}`).join("\n")}

🟢 System ist ONLINE
📈 Trading wieder aktiv
🕐 ${new Date().toLocaleString("de-CH")}`
        );
      } else {
        // Execute full shutdown
        await reply(chatId, "🔒 Passwort korrekt. Führe vollständigen Shutdown durch...");
        const log = await executeFullShutdown(name);
        await sendTelegram(
`🚨 <b>KILL SWITCH — VOLLSTÄNDIGER SHUTDOWN</b>

Ausgelöst von: ${name} (Admin via Telegram)

<b>Ausgeführt:</b>
${log.map(l => `• ${l}`).join("\n")}

🔴 System ist OFFLINE
⛔ Alle Ausführungen blockiert
🕐 ${new Date().toLocaleString("de-CH")}

Um das System zu reaktivieren: /reset + Admin-Passwort`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    if (textLower === "/killswitch" || textLower === "/ks") {
      const ks = getKillswitchReport();
      if (ks.triggered) {
        await reply(chatId, "⚠️ Kill Switch ist bereits aktiv. Nutze /reset zum Zurücksetzen.");
        return NextResponse.json({ ok: true });
      }

      // Ask for password
      pendingConfirm.set(chatId, { action: "killswitch", expiresAt: Date.now() + 60_000 });
      await reply(chatId,
`🔐 <b>Kill Switch — Admin-Bestätigung erforderlich</b>

Du hast /killswitch aufgerufen. Dies wird:
• Alle offenen Positionen schliessen (Capital.com + IC Markets)
• Beide Broker trennen
• Das System in den Offline-Modus versetzen
• Alle weiteren Ausführungen blockieren

⏱ Gib jetzt dein <b>Admin-Passwort</b> ein (60 Sekunden):
<i>(Das Passwort ist in Railway als KILLSWITCH_PASSWORD gesetzt)</i>`
      );
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/reset") {
      const ks = getKillswitchReport();
      if (!ks.triggered) {
        await reply(chatId, "ℹ️ Kill Switch ist nicht aktiv — kein Reset nötig.");
        return NextResponse.json({ ok: true });
      }

      // Ask for password to reset too
      pendingConfirm.set(chatId, { action: "reset", expiresAt: Date.now() + 60_000 });
      await reply(chatId,
`🔐 <b>Kill Switch Reset — Admin-Bestätigung erforderlich</b>

Gib dein <b>Admin-Passwort</b> ein um das System zu reaktivieren (60 Sekunden):`
      );
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/status") {
      const ks = getKillswitchReport();
      const statusEmoji = ks.triggered ? "🔴" : "🟢";
      await reply(chatId,
`${statusEmoji} <b>System Status</b>

Kill Switch: ${ks.triggered ? "AKTIV 🚨" : "Armed ✅"}
System: ${ks.systemLocked ? "OFFLINE 🔴" : "ONLINE 🟢"}
🕐 ${new Date().toLocaleString("de-CH")}

Befehle:
/killswitch — Vollständiger Shutdown (Passwort erforderlich)
/reset — System reaktivieren (Passwort erforderlich)
/status — System Status
/help — Alle Befehle`
      );
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/help") {
      await reply(chatId,
`🤖 <b>Destinate Trading Bot</b>

<b>Sicherheits-Befehle:</b>
/killswitch — Vollständiger Shutdown (Passwort nötig)
/ks — Kurzform für /killswitch
/reset — System reaktivieren (Passwort nötig)
/status — Aktueller System Status

<b>Sicherheit:</b>
• Alle kritischen Befehle erfordern Admin-Passwort
• Falsches Passwort → sofortiger Sicherheitsalert
• Unbekannte Chat-IDs werden geblockt und gemeldet
• Passwort wird in Railway als KILLSWITCH_PASSWORD gesetzt`
      );
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith("/")) {
      await reply(chatId, `❓ Unbekannter Befehl: ${text}\n\nSchreibe /help für alle Befehle.`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram-webhook] Error:", err);
    return NextResponse.json({ ok: true }); // always 200 to Telegram
  }
}
