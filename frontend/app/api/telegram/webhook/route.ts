export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sendTelegram, telegramZeit, telegramDatum } from "@/lib/telegram-notifications/telegram-sender";
import { triggerKillswitch, resetKillswitch, getKillswitchReport } from "@/lib/killswitch";
// STATISCH, nicht dynamisch: das Modul ist winzig, rein und ohne
// Nebenwirkungen. Ein `await import()` haette hier nur eine zusaetzliche
// LAUFZEIT-Fehlerquelle geschaffen — ausgerechnet in `/status`, dem Befehl,
// den man benutzt, wenn ohnehin etwas kaputt ist. Statisch schlaegt ein
// Problem beim BAUEN auf, nicht im Ernstfall.
import { laufzeitStand, laufzeitZeilen } from "@/lib/laufzeit/laufzeit-stand";
// STATISCH, wie `laufzeit-stand`: winzig, rein, ohne Nebenwirkungen. Ein
// dynamischer Import waere eine Laufzeit-Fehlerquelle ausgerechnet in dem
// Befehl, den man benutzt, wenn ohnehin etwas kaputt ist (27.10.).
import { handelsLage } from "@/lib/handels-lage/handels-lage";

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

/**
 * Die System-Befehle — EINE Liste (29.09.).
 *
 * Es gab ZWEI: eine kurze in `/status` und eine lange in `/help`. Beim Einbau
 * von `/peakreset` wurde nur die in `/help` nachgezogen — der neue Befehl war
 * damit ueber `/status` nicht auffindbar. Aufgefallen ist das erst beim
 * Gegenlesen eines Screenshots.
 *
 * Das ist exakt die Fehlerklasse, die dieses Projekt im Dashboard schon
 * einmal getroffen hat (Menueeintrag ohne Render-Zeile, 26.08.): zwei Listen,
 * die deckungsgleich sein muessen, und eine wird vergessen. Die Antwort ist
 * nicht "an beiden Stellen eintragen", sondern EINE Liste.
 *
 * `safety-nets` haelt zusaetzlich fest, dass JEDER behandelte Befehl in der
 * Hilfe steht — dynamisch aus dem Quelltext gelesen, nicht aus einer festen
 * Aufzaehlung.
 */
const SYSTEM_BEFEHLE = [
  "/killswitch — Vollständiger Shutdown (Passwort erforderlich)",
  "/reset — System reaktivieren (Passwort erforderlich)",
  "/peakreset — Drawdown-Höchststand zurücksetzen (Passwort erforderlich)",
  "/status — System Status",
  "/edge — Erwartungswert: hat das System einen Edge? (/edge 60 = letzte 60 Tage)",
  "/hebel — was würde etwas ändern? EW je Gruppe (/hebel 60 = letzte 60 Tage)",
  "/help — Alle Befehle",
].join("\n");

/**
 * Antwort an Telegram — MIT Auswertung (26.10.).
 *
 * Bis heute stand hier nur `.catch(() => {})`: kein Status, kein
 * Antwortkörper. Telegram lehnt einen Versand mit **HTTP 200** und
 * `{ok:false, description:"…"}` ab — eine zu lange Nachricht, ein kaputtes
 * HTML-Tag, eine Drosselung. Der Befehl verpuffte dann **spurlos**, und im
 * Log stand nichts.
 *
 * Das ist dieselbe Fehlerklasse, die am 25.10. für `sendTelegram` behoben
 * wurde (`d47b772`) — aber `reply` ist die **eigene** Funktion des Webhooks
 * und war nie erfasst. Durch sie geht **jede** Antwort: `/status`,
 * `/killswitch`, `/reset`, `/peakreset`, `/edge`.
 *
 * Gemeldet wird ins **Konsolen-Log**, nicht nach Telegram: der Kanal ist ja
 * gerade der defekte. Und der GRUND steht in `description` — ihn
 * wegzuwerfen hiesse, ihn später raten zu müssen.
 *
 * Die Rückgabe bleibt bewusst `void`. Ein `boolean`, den keiner der
 * Aufrufer liest, wäre genau der Fehler vom 25.10. in neuer Verpackung —
 * die Logzeile IST die Auswertung.
 */
async function reply(chatId: number, text: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const roh = await res.text().catch(() => "");
    let grund = "";
    if (!roh) {
      grund = `HTTP ${res.status} — leere Antwort`;
    } else {
      try {
        const d = JSON.parse(roh) as { ok?: boolean; description?: string; error_code?: number };
        if (d.ok !== true) {
          grund = `${d.error_code ?? res.status} ${d.description ?? "ok=false"}`.trim();
        }
      } catch {
        grund = `HTTP ${res.status} — Antwort unlesbar: ${roh.slice(0, 200)}`;
      }
    }
    if (grund) {
      console.error(`[telegram-webhook] ❌ Antwort NICHT zugestellt `
        + `(${text.length} Zeichen): ${grund} — der Befehl verpufft sonst spurlos.`);
    }
  } catch (e) {
    console.error(`[telegram-webhook] ❌ Antwort NICHT zugestellt `
      + `(${text.length} Zeichen): ${e instanceof Error ? e.message : String(e)}`);
  }
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
🕐 ${telegramZeit()}`
      );
      await reply(chatId, "⛔ Nicht autorisiert. Dieser Vorfall wurde gemeldet.");
      return NextResponse.json({ ok: true });
    }

    // ── Password confirmation flow ─────────────────────────────────────────────
    const pending = pendingConfirm.get(chatId);

    // ── EIN BEFEHL IST KEIN PASSWORT (29.09.) ───────────────────────────────
    //
    // Diese Pruefung steht VOR der Befehlsauswertung. Wer also innerhalb der
    // 60 Sekunden nach `/killswitch`, `/reset`, `/peakreset` oder `/block`
    // irgendetwas schickt — auch `/status` oder `/help` —, dessen Nachricht
    // galt als PASSWORTVERSUCH: falsches Passwort, Sicherheitsalarm, und der
    // eigene Befehl stand (bis zum Fix darueber) im Alarmtext.
    //
    // Eine Nachricht, die mit `/` beginnt, bricht die Bestaetigung jetzt ab
    // und laeuft als ganz normaler Befehl weiter. Kein Alarm, kein Verlust:
    // der abgebrochene Befehl laesst sich jederzeit neu senden.
    //
    // PREIS, und er steht deshalb in der Meldung: das Admin-Passwort darf
    // nicht mit `/` beginnen. Das ist die deutlich kleinere Einschraenkung —
    // die Alternative waere, weiter jeden Tippfehler zu einem Alarm zu
    // machen und jeden Befehl in einen Passwortversuch zu verwandeln.
    if (pending && text.startsWith("/")) {
      pendingConfirm.delete(chatId);
      await reply(chatId,
        `↩️ Bestätigung für "<code>${pending.action}</code>" abgebrochen — `
        + `du hast einen Befehl geschickt, kein Passwort. Es wurde NICHTS ausgeführt.\n\n`
        + `<i>Hinweis: das Admin-Passwort darf nicht mit / beginnen.</i>`);
      // KEIN return: die Nachricht wird unten als normaler Befehl behandelt.
    } else if (pending) {
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
        // ── DIE FEHLMELDUNG GAB DAS PASSWORT AUS (29.09.) ─────────────────
        //
        // Hier stand `Eingabe: <code>${text.slice(0, 20)}***</code>`.
        //
        // Ein Tippfehler im LETZTEN Zeichen des richtigen Passworts schickte
        // damit bis zu zwanzig RICHTIGE Zeichen im Klartext in den Chat. Es
        // ist der eigene Kanal — aber ein Admin-Passwort gehoert nirgends
        // echot: ein Telegram-Verlauf liegt auf jedem angemeldeten Geraet und
        // auf Telegrams Servern, und er laesst sich nicht zurueckholen.
        //
        // Der Alarm behaelt seinen Zweck. Zur Einordnung genuegt, WAS es war
        // (Laenge, und ob es wie ein Befehl aussah) — der Inhalt nicht.
        const art = text.startsWith("/") ? "sah aus wie ein Befehl" : "Freitext";
        await sendTelegram(
`🚨 <b>Falsches Admin-Passwort!</b>

Jemand hat versucht, den Kill Switch mit falschem Passwort auszulösen.
Eingabe: ${text.length} Zeichen, ${art} — der Inhalt wird bewusst NICHT ausgegeben.
🕐 ${telegramZeit()}`
        );
        await reply(chatId, "❌ Falsches Passwort. Kill Switch verweigert. Sicherheitsalert gesendet.");
        return NextResponse.json({ ok: true });
      }

      pendingConfirm.delete(chatId);

      if (pending.action.startsWith("unblock:")) {
        const ipToUnblock = pending.action.split(":")[1];
        const { unblockIP, whitelistIP } = await import("@/lib/security-watchdog/ip-blocklist");
        await unblockIP(ipToUnblock);
        await whitelistIP(ipToUnblock, "Auto-Whitelist nach /unblock");
        await reply(chatId, `✅ IP <code>${ipToUnblock}</code> freigeschaltet + auf Whitelist.\n\n🛡 Watchdog wird diese IP nicht mehr automatisch sperren.`);
        await sendTelegram(`🔓 <b>IP freigegeben + Whitelist</b>\n\nIP: <code>${ipToUnblock}</code>\nFreigegeben von: ${name}\n🛡 Auf Whitelist — kein Auto-Block mehr\n🕐 ${telegramZeit()}`);
      } else if (pending.action.startsWith("apply:")) {
        const symbolToApply = pending.action.split(":")[1];
        const { applyOverride } = await import("@/lib/analysis-engine/overrides-store");
        const ov = await applyOverride(symbolToApply, name);
        if (ov) {
          await reply(chatId, `✅ Override für <b>${symbolToApply.toUpperCase()}</b> angewendet:\n` +
            `Style: ${ov.style} | Strategie: ${ov.strategy}\n` +
            `SL: ${((ov.slPct ?? 0) * 100).toFixed(1)}% | TP: ${((ov.tpPct ?? 0) * 100).toFixed(1)}%\n\n` +
            `Gilt 30 Tage. Zurücknehmen: /unapply ${symbolToApply.toUpperCase()}`);
        } else {
          await reply(chatId, `❌ Kein Vorschlag für ${symbolToApply.toUpperCase()} gefunden. /vorschlaege zeigt die aktuelle Liste.`);
        }
      } else if (pending.action.startsWith("unapply:")) {
        const symbolToUnapply = pending.action.split(":")[1];
        const { unapplyOverride } = await import("@/lib/analysis-engine/overrides-store");
        const removed = await unapplyOverride(symbolToUnapply);
        await reply(chatId, removed
          ? `✅ Override für <b>${symbolToUnapply.toUpperCase()}</b> entfernt — Symbol handelt wieder normal.`
          : `ℹ️ Kein aktiver Override für ${symbolToUnapply.toUpperCase()}.`);
      } else if (pending.action.startsWith("block:")) {
        const ipToBlock = pending.action.split(":")[1];
        const { blockIP } = await import("@/lib/security-watchdog/ip-blocklist");
        await blockIP(ipToBlock, `Manuell geblockt von Admin via Telegram`, true);
        await reply(chatId, `🚫 IP <code>${ipToBlock}</code> wurde PERMANENT gesperrt.`);
        await sendTelegram(`🚫 <b>IP manuell gesperrt</b>\n\nIP: <code>${ipToBlock}</code>\nGesperrt von: ${name} (PERMANENT)\n🕐 ${telegramZeit()}`);
      } else if (pending.action.startsWith("trust:")) {
        const ipToTrust = pending.action.split(":")[1];
        const { whitelistIP } = await import("@/lib/security-watchdog/ip-blocklist");
        await whitelistIP(ipToTrust, `Manuell vertraut von Admin via Telegram`);
        await reply(chatId, `🛡 IP <code>${ipToTrust}</code> auf Whitelist.\n\nWatchdog wird diese IP nie automatisch sperren.`);
        await sendTelegram(`🛡 <b>IP auf Whitelist</b>\n\nIP: <code>${ipToTrust}</code>\nHinzugefügt von: ${name}\n🕐 ${telegramZeit()}`);
      } else if (pending.action.startsWith("untrust:")) {
        const ipToUntrust = pending.action.split(":")[1];
        const { unwhitelistIP } = await import("@/lib/security-watchdog/ip-blocklist");
        await unwhitelistIP(ipToUntrust);
        await reply(chatId, `⚠️ IP <code>${ipToUntrust}</code> von Whitelist entfernt.\n\nWatchdog kann diese IP jetzt wieder automatisch sperren.`);
        await sendTelegram(`⚠️ <b>IP von Whitelist entfernt</b>\n\nIP: <code>${ipToUntrust}</code>\nEntfernt von: ${name}\n🕐 ${telegramZeit()}`);
      } else if (pending.action === "reset") {
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
🕐 ${telegramZeit()}`
        );
      } else if (pending.action === "peakreset") {
        // ── HOECHSTSTAND ZURUECKSETZEN (29.09.) ─────────────────────────────
        //
        // Der Gesamt-Drawdown misst vom hoechsten je gesehenen Kontostand, und
        // der liegt ein JAHR in Redis. Bis heute gab es aus einer Sperre genau
        // zwei Auswege: Kontostand ueber den Hoechststand heben oder die Grenze
        // hochziehen. Nach einem Demokonto-Reset — oder nach einem
        // Hoechststand, der gar nicht echt war — ist das eine Sackgasse.
        //
        // Der Befehl SENKT den Schutz. Deshalb steht er hinter demselben
        // Admin-Passwort wie der Killswitch, und der alte Wert wird genannt:
        // ein stiller Reset waere schlimmer als gar keiner.
        const { peakZuruecksetzen } = await import("@/lib/trading-filters/trade-filters");
        const { getCapitalSession } = await import("@/lib/capital-com/capital-com-session");
        const ergebnis = await peakZuruecksetzen();
        if (!ergebnis.ok) {
          await reply(chatId, `❌ Zuruecksetzen fehlgeschlagen: ${ergebnis.fehler ?? "unbekannt"}`);
          return NextResponse.json({ ok: true });
        }
        const stand = getCapitalSession()?.balance;
        const standText = Number.isFinite(stand) ? (stand as number).toFixed(2) : "unbekannt (Broker nicht verbunden)";
        await reply(chatId, "♻️ Passwort korrekt. Höchststand wird zurückgesetzt...");
        await sendTelegram(
`♻️ <b>DRAWDOWN-HÖCHSTSTAND ZURÜCKGESETZT</b>

Zurückgesetzt von: ${name} (Admin via Telegram)

Bisheriger Höchststand: <b>${ergebnis.alt === null ? "war nicht gesetzt" : ergebnis.alt.toFixed(2)}</b>
Aktueller Kontostand: <b>${standText}</b>

Der nächste Handelszyklus setzt den Höchststand auf den aktuellen
Kontostand. Ab dann misst der Gesamt-Drawdown wieder von dort.

⚠️ Das SENKT den Schutz: ein Verlust, der vorher gesperrt hätte, tut es
jetzt nicht mehr. Die Grenze selbst ist unverändert.
🕐 ${telegramZeit()}`
        );
      } else if (pending.action === "killswitch") {
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
🕐 ${telegramZeit()}

Um das System zu reaktivieren: /reset + Admin-Passwort`
        );
      } else {
        // ── KEIN STILLER AUFFANG MEHR (29.09.) ──────────────────────────────
        //
        // Hier stand `} else {` mit dem Shutdown darin — jede NICHT erkannte
        // Aktion loeste also nach korrektem Passwort einen vollstaendigen
        // Shutdown aus, inklusive Schliessen aller Positionen. Wer eine neue
        // Aktion einbaut und den Zweig vergisst, haette damit unbemerkt den
        // Notaus verdrahtet.
        //
        // Jetzt ist "killswitch" ein eigener, benannter Zweig, und ein
        // unbekannter Name tut NICHTS — sagt das aber, statt zu schweigen.
        console.error(`[telegram-webhook] Unbekannte Bestaetigungs-Aktion: ${pending.action}`);
        await reply(chatId, `⚠️ Unbekannter Vorgang "<code>${pending.action}</code>" — es wurde NICHTS ausgeführt. `
          + `Bitte den Befehl erneut senden.`);
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

    if (textLower === "/peakreset") {
      const { PEAK_SCHLUESSEL } = await import("@/lib/trading-filters/trade-filters");
      const { cacheGet } = await import("@/lib/cache/redis-cache");
      const { getCapitalSession } = await import("@/lib/capital-com/capital-com-session");
      const jetzt = await cacheGet<{ peak: number }>(PEAK_SCHLUESSEL).catch(() => null);
      const stand = getCapitalSession()?.balance;

      if (!jetzt || !Number.isFinite(jetzt.peak)) {
        await reply(chatId, "ℹ️ Es ist gar kein Höchststand gespeichert — nichts zurückzusetzen. "
          + "Der nächste Handelszyklus setzt ihn auf den aktuellen Kontostand.");
        return NextResponse.json({ ok: true });
      }

      pendingConfirm.set(chatId, { action: "peakreset", expiresAt: Date.now() + 60_000 });
      await reply(chatId,
`♻️ <b>Drawdown-Höchststand zurücksetzen — Admin-Bestätigung erforderlich</b>

Gespeicherter Höchststand: <b>${jetzt.peak.toFixed(2)}</b>
Aktueller Kontostand: <b>${Number.isFinite(stand) ? (stand as number).toFixed(2) : "unbekannt"}</b>

Dies wird:
• den gespeicherten Höchststand löschen
• den nächsten Zyklus ihn auf den aktuellen Kontostand setzen lassen
• eine bestehende Gesamt-Drawdown-Sperre damit aufheben

⚠️ Das SENKT den Schutz. Die Einstellung „Max Total Drawdown" bleibt
unverändert — nur der Bezugspunkt wird neu gesetzt.

⏱ Gib jetzt dein <b>Admin-Passwort</b> ein (60 Sekunden):`
      );
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/status") {
      const ks = getKillswitchReport();
      const statusEmoji = ks.triggered ? "🔴" : "🟢";
      // WELCHER STAND LÄUFT? (27.10.)
      //
      // Am 27.10. wurde ein Fix um 22:59:36 gepusht und um 23:01 ausprobiert.
      // Railway war noch am Bauen, der Bot antwortete "Unbekannter Befehl" —
      // und es gab keine Moeglichkeit, das festzustellen ausser Raten.
      // Im Ernstfall ist das die Frage VOR dem /reset: ist der Fix oben?
      //
      // Die Zeit wird mit `telegramZeit()` formatiert, nicht in der Funktion
      // — ein nacktes toLocaleString im Telegram-Weg war der Fehler vom 27.09.
      const stand = laufzeitStand(process.env, process.uptime(), Date.now());
      const zeilen = laufzeitZeilen(stand,
        stand.startMs === null ? null : telegramZeit(new Date(stand.startMs)));

      // ── WARUM KEIN TRADE? (29.10.) ────────────────────────────────────
      //
      // `System: ONLINE` misst NUR den Killswitch. Vom 23. bis 29.10. wurde
      // keine Position eroeffnet, und `/status` sagte durchgehend ONLINE —
      // die Diagnose schwieg im interessanten Fall (Klasse 30.09.).
      //
      // JEDE Angabe einzeln abgesichert: faellt eine Quelle aus, heisst sie
      // UNBEKANNT und die Antwort kommt trotzdem. Dieser Befehl wird
      // gelesen, WEIL etwas kaputt ist — er darf an keiner Quelle scheitern
      // und an keiner haengenbleiben (deshalb die Zeitgrenze).
      const sicher = async <T>(f: () => Promise<T>): Promise<T | null> => {
        try {
          return await Promise.race([
            f(),
            new Promise<null>((r) => setTimeout(() => r(null), 5000)),
          ]);
        } catch { return null; }
      };

      // NEBENEINANDER, nicht nacheinander: sieben Quellen mal fuenf
      // Sekunden Obergrenze waeren 35 s bis zur Antwort. Keine haengt von
      // einer anderen ab, also ist die Obergrenze so fuenf Sekunden.
      const [einst, sitzung, offeneZahl, hoechst, tagessumme, inZeit, tagesZaehler] =
        await Promise.all([
      sicher(async () => {
        const { getSettings } = await import("@/lib/settings/settings-store");
        return await getSettings();
      }),
      sicher(async () => {
        const m = await import("@/lib/capital-com/capital-com-session");
        return { verbunden: m.isCapitalConnected(), sess: m.getCapitalSession() };
      }),
      sicher(async () => {
        const m = await import("@/lib/capital-com/capital-com-session");
        const sx = m.getCapitalSession();
        if (!sx) return null;
        const { capitalGetPositions } = await import("@/lib/capital-com/capital-com-client");
        const r = await capitalGetPositions(sx.apiKey, sx.cst, sx.securityToken);
        return r?.ok && Array.isArray(r.positions) ? r.positions.length : null;
      }),
      sicher(async () => {
        const { PEAK_SCHLUESSEL } = await import("@/lib/trading-filters/trade-filters");
        const { cacheGet } = await import("@/lib/cache/redis-cache");
        const v = await cacheGet<{ peak: number }>(PEAK_SCHLUESSEL);
        return typeof v?.peak === "number" ? v.peak : null;
      }),
      sicher(async () => {
        const { TAGESSUMME_SCHLUESSEL, handelstag } =
          await import("@/lib/zyklus-bilanz/zyklus-bilanz");
        const { cacheGet } = await import("@/lib/cache/redis-cache");
        // Die Felder heissen wie in `Tagessumme` (zyklus-bilanz.ts) — dort
        // werden sie gezaehlt, hier nur gelesen.
        return await cacheGet<{
          zyklen?: number; ausgaenge?: Record<string, number>;
          scans?: number; maerkte?: number;
          gpt?: { WAIT?: number; BUY?: number; SELL?: number };
          vetos?: number; stilVerworfen?: number;
          ohneVolleDaten?: number; ohneVolleDatenGrund?: Record<string, number>;
          unterGrenze?: number; confMin?: number | null; confMax?: number | null;
          rrAbgelehnt?: number; ohneStopZiel?: number; go?: number;
        }>(TAGESSUMME_SCHLUESSEL(handelstag()));
      }),
      sicher(async () => {
        const { isWithinTradingSession } = await import("@/lib/agents/orchestrator-agent");
        return isWithinTradingSession();
      }),
      // EIN LESEPFAD LEGT GEMEINSAMEN ZUSTAND NICHT AN (Regel vom 07.09.).
      // Besitzer von `__daily_trades__` ist der Orchestrator. Passt das
      // Datum nicht, wird hier NICHT geschrieben, sondern dieselbe Quelle
      // gelesen, die der Besitzer liest: Redis `daily_trades:<UTC-Datum>`.
      sicher(async () => {
        const heuteKey = new Date().toISOString().slice(0, 10);
        const dt = global.__daily_trades__;
        if (dt && dt.date === heuteKey && typeof dt.count === "number") return dt.count;
        const { cacheGet } = await import("@/lib/cache/redis-cache");
        const v = await cacheGet<{ count: number }>(`daily_trades:${heuteKey}`);
        return typeof v?.count === "number" ? v.count : null;
      }),
        ]);

      // EIN AUSFALL DARF `/status` NICHT UMBRINGEN — und sich auch nicht
      // als Ergebnis ausgeben. Aufgefallen im Pruefstand: ein geworfener
      // Aufruf liess den ganzen Befehl sterben, statt zu antworten.
      // Deshalb Rueckfall MIT Grund statt stumm.
      let lageZeilen: string[];
      try {
        lageZeilen = handelsLage({
          brokerVerbunden: sitzung ? sitzung.verbunden : null,
          modus: einst?.botSettings?.mode ?? null,
          offenePositionen: offeneZahl,
          maxGleichzeitig: einst?.botSettings?.maxConcurrentPositions ?? null,
          tagesZaehler,
          tagesLimit: einst?.botSettings?.maxTradesPerDay ?? null,
          tagesLimitAktiv: einst?.botSettings?.tradeLimitEnabled ?? null,
          kontostand: typeof sitzung?.sess?.balance === "number" ? sitzung.sess.balance : null,
          hoechststand: hoechst,
          maxDrawdownProzent: einst?.riskSettings?.maxTotalDrawdownPct ?? null,
          inHandelszeit: inZeit,
          zyklenHeute: typeof tagessumme?.zyklen === "number" ? tagessumme.zyklen : null,
          ausgaenge: tagessumme?.ausgaenge ?? null,
          // Der Trichter kommt aus DERSELBEN Tagessumme. Fehlt sie, ist
          // er `null` — unbekannt, nicht "alles null".
          trichter: tagessumme
            ? {
              scans: tagessumme.scans ?? null,
              maerkte: tagessumme.maerkte ?? null,
              richtungen: typeof tagessumme.gpt?.BUY === "number"
                && typeof tagessumme.gpt?.SELL === "number"
                ? tagessumme.gpt.BUY + tagessumme.gpt.SELL : null,
              vetos: tagessumme.vetos ?? null,
              stilVerworfen: tagessumme.stilVerworfen ?? null,
              ohneVolleDaten: tagessumme.ohneVolleDaten ?? null,
              ohneVolleDatenGrund: tagessumme.ohneVolleDatenGrund ?? null,
              unterGrenze: tagessumme.unterGrenze ?? null,
              confMin: tagessumme.confMin ?? null,
              confMax: tagessumme.confMax ?? null,
              rrAbgelehnt: tagessumme.rrAbgelehnt ?? null,
              ohneStopZiel: tagessumme.ohneStopZiel ?? null,
              go: tagessumme.go ?? null,
            }
            : null,
        }).zeilen;
      } catch (e) {
        lageZeilen = ["❔ Lage nicht berechenbar — "
          + (e instanceof Error ? e.message : String(e))];
      }

      await reply(chatId,
`${statusEmoji} <b>System Status</b>

Kill Switch: ${ks.triggered ? "AKTIV 🚨" : "Armed ✅"}
System: ${ks.systemLocked ? "OFFLINE 🔴" : "ONLINE 🟢"} <i>(nur der Killswitch)</i>
🕐 ${telegramZeit()}

🧩 <b>Laufender Stand</b>
${zeilen.join("\n")}

🔎 <b>Warum kein Trade?</b>
${lageZeilen.join("\n")}

Befehle:
${SYSTEM_BEFEHLE}`
      );
      return NextResponse.json({ ok: true });
    }

    // ── /edge — hat das System einen Edge? (26.10.) ──────────────────────
    //
    // REINE LESUNG: keine Order, kein Stop, keine Einstellung. Steht bewusst
    // NACH der Passwort-Bestaetigung weiter oben, damit die Reihenfolge der
    // Zweige vom 29.09. unberuehrt bleibt ("ein Befehl ist kein Passwort").
    //
    // Die Datenqualitaet steht MIT im Ergebnis: seit dem 30.09. ist belegt,
    // dass ein Trade zwei Journal-Zeilen erzeugen konnte — eine davon mit
    // P&L 0 als BREAKEVEN. Ein Erwartungswert, der die nicht ausweist, waere
    // irrefuehrend.
    if (textLower === "/edge" || textLower.startsWith("/edge ")) {
      try {
        // `/edge 60` rechnet NUR die letzten 60 Tage.
        //
        // Grund, gemessen am 26.10.: die Historie zerfaellt in ZWEI Systeme.
        // Bis Mitte August Zeilen ohne Ausstiegsgrund mit Oe Gewinn 21.43 und
        // R/R 1.11, danach welche mit Grund und Oe Gewinn 3.13 bei R/R 0.43.
        // Zusammengerechnet ergibt das ein R/R von 0.75, das KEINES von beiden
        // beschreibt — und die daraus abgeleiteten Hebel zeigen falsch.
        const arg = textLower.slice("/edge".length).trim();
        // NUR Ziffern. `Number.parseInt("1e", 10)` ergibt **1** — es liest die
        // fuehrenden Ziffern und wirft den Rest weg. `/edge 1e` waere damit
        // still zu einem 1-Tage-Fenster geworden und `/edge 60xyz` zu 60:
        // eine Eingabe geraten, die so nie gemeint war. Gefunden vom
        // End-to-End-Pruefstand, nicht von Hand.
        // Ohne Angabe ist es ausdruecklich `null` (= alles) und nicht `NaN`,
        // das die Rechnung erst wieder auffangen muesste. Ein Ergebnis, das
        // nur stimmt, weil es jemand weiter innen repariert, ist Zufall.
        const tage = arg === "" ? null : (/^\d+$/.test(arg) ? Number(arg) : NaN);
        if (arg !== "" && (!Number.isFinite(tage) || (tage as number) <= 0)) {
          // Eine unbrauchbare Angabe darf nicht stillschweigend zu "alles"
          // werden: die Antwort saehe dann nach Fenster aus und waere keines.
          //
          // DIE EINGABE WIRD NICHT ZURUECKGESCHICKT. Regel vom 29.09. („ein
          // Admin-Passwort gehoert nirgends echot"), hier an anderer Stelle:
          // ein Telegram-Verlauf liegt auf jedem angemeldeten Geraet und auf
          // Telegrams Servern und laesst sich nicht zurueckholen. Wer sich
          // vertippt und `/edge <etwas Vertrauliches>` schickt, haette es
          // sonst dauerhaft im Chat. Die Meldung braucht das Argument auch
          // gar nicht — Laenge und die richtige Form erklaeren alles.
          await reply(chatId,
            `⚠️ <b>/edge</b> — das ist keine Anzahl Tage (${arg.length} Zeichen).`
            + "\n\n<code>/edge</code> rechnet alles, <code>/edge 60</code> nur "
            + "die letzten 60 Tage.");
          return NextResponse.json({ ok: true });
        }
        const { getPrisma } = await import("@/app/lib/prisma");
        const { erwartungswert, erwartungswertText } =
          await import("@/lib/expectancy/erwartungswert");
        const zeilen = await getPrisma().trade.findMany({
          where: { status: { not: "OPEN" } },
          // `result` gehoert dazu: eine Zeile, deren `profitLoss` NIE
          // geschrieben wurde, steht wegen `Float @default(0)` auf exakt 0
          // und ist von einem echten Breakeven an der Zahl allein nicht zu
          // unterscheiden. Am Etikett schon.
          // `updatedAt` beantwortet die Frage, wegen der es die Herkunft gibt:
          // wird ein Etikett HEUTE noch erzeugt, oder ist es Altbestand?
          select: { profitLoss: true, notes: true, result: true, updatedAt: true },
        });
        await reply(chatId, erwartungswertText(
          erwartungswert(zeilen, tage === null ? null : { tage })));
      } catch (e) {
        // Der Grund gehoert in die Antwort — sonst steht man vor einem
        // stummen Befehl und raet ("wer den Grund nicht mitschreibt …").
        await reply(chatId,
          `❌ <b>/edge fehlgeschlagen</b>\n\n${e instanceof Error ? e.message : String(e)}`);
      }
      return NextResponse.json({ ok: true });
    }

    // ── /hebel — welche Einstellung wuerde etwas aendern? (29.10.) ───────
    //
    // REINE RECHNUNG: keine Order, kein Stop, keine Einstellung. Steht
    // bewusst NACH der Passwort-Bestaetigung weiter oben, damit die
    // Reihenfolge der Zweige vom 29.09. unberuehrt bleibt.
    //
    // Die Argumentpruefung ist WOERTLICH die von /edge: `parseInt` liest,
    // was es kriegen kann (`"1e"` ergibt 1), und die Eingabe wird NICHT
    // zurueckgeschickt — ein Telegram-Verlauf laesst sich nicht
    // zurueckholen (29.09.).
    if (textLower === "/hebel" || textLower.startsWith("/hebel ")) {
      try {
        const arg = textLower.slice("/hebel".length).trim();
        const tage = arg === "" ? null : (/^\d+$/.test(arg) ? Number(arg) : NaN);
        if (arg !== "" && (!Number.isFinite(tage) || (tage as number) <= 0)) {
          await reply(chatId,
            `⚠️ <b>/hebel</b> — das ist keine Anzahl Tage (${arg.length} Zeichen).`
            + "\n\n<code>/hebel</code> rechnet alles, <code>/hebel 60</code> nur "
            + "die letzten 60 Tage.");
          return NextResponse.json({ ok: true });
        }
        const { getPrisma } = await import("@/app/lib/prisma");
        const { hebelBericht, hebelText } = await import("@/lib/hebel/hebel");
        // Dieselben vier Spalten wie /edge (sonst waeren die Ausschluesse
        // andere) PLUS die Groessen, an denen sich drehen laesst.
        const zeilen = await getPrisma().trade.findMany({
          where: { status: { not: "OPEN" } },
          select: {
            profitLoss: true, notes: true, result: true, updatedAt: true,
            riskReward: true, market: true, direction: true, strategy: true,
          },
        });
        await reply(chatId, hebelText(
          hebelBericht(zeilen, tage === null ? null : { tage }),
          tage === null ? null : (tage as number)));
      } catch (e) {
        await reply(chatId,
          `❌ <b>/hebel fehlgeschlagen</b>\n\n${e instanceof Error ? e.message : String(e)}`);
      }
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/help") {
      await reply(chatId,
`🤖 <b>Destinate Trading Bot</b>

<b>System-Befehle:</b>
${SYSTEM_BEFEHLE}
/ks — Kurzform für /killswitch

<b>IP-Verwaltung:</b>
/blocked — Alle gesperrten IPs anzeigen
/block [ip] — IP manuell PERMANENT sperren (Passwort nötig)
/unblock [ip] — IP freischalten + Whitelist (Passwort nötig)
/trusted — Alle Whitelist-IPs anzeigen
/trust [ip] — IP auf Whitelist (auch Subnetz: /trust 176.113.69.*)
/untrust [ip] — IP von Whitelist entfernen

<b>Analysis Engine (Lern-System):</b>
/vorschlaege — Verbesserungs-Vorschläge anzeigen (auch /vorschläge)
/apply [symbol] — Vorschlag anwenden (Passwort nötig)
/unapply [symbol] — Override entfernen (Passwort nötig)

<b>Sicherheit:</b>
• Alle kritischen Befehle erfordern Admin-Passwort
• Falsches Passwort → sofortiger Sicherheitsalert
• Whitelisted IPs: Watchdog analysiert, aber kein Auto-Block`
      );
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/blocked") {
      const { getBlockedIPs } = await import("@/lib/security-watchdog/ip-blocklist");
      const list = await getBlockedIPs();
      if (list.length === 0) {
        await reply(chatId, "✅ Keine IPs geblockt.");
      } else {
        const lines = list.map(e =>
          `${e.permanent ? "🔴 PERMANENT" : "⏱ 72h"} <code>${e.ip}</code>\n   ${e.reason.slice(0, 60)}\n   Seit: ${telegramZeit(new Date(e.blockedAt))}`
        ).join("\n\n");
        await reply(chatId, `🚫 <b>Geblockte IPs (${list.length}):</b>\n\n${lines}`);
      }
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith("/unblock ")) {
      const ipToUnblock = text.split(" ")[1]?.trim();
      if (!ipToUnblock) {
        await reply(chatId, "❓ Verwendung: /unblock [IP-Adresse]\nBeispiel: /unblock 85.155.182.244");
        return NextResponse.json({ ok: true });
      }
      pendingConfirm.set(chatId, { action: `unblock:${ipToUnblock}`, expiresAt: Date.now() + 60_000 });
      await reply(chatId, `🔐 IP <code>${ipToUnblock}</code> freischalten + Whitelist?\n\nGib dein <b>Admin-Passwort</b> ein (60 Sekunden):`);
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith("/block ")) {
      const ipToBlock = text.split(" ")[1]?.trim();
      if (!ipToBlock) {
        await reply(chatId, "❓ Verwendung: /block [IP-Adresse]\nBeispiel: /block 178.197.207.245");
        return NextResponse.json({ ok: true });
      }
      pendingConfirm.set(chatId, { action: `block:${ipToBlock}`, expiresAt: Date.now() + 60_000 });
      await reply(chatId, `🔐 IP <code>${ipToBlock}</code> PERMANENT sperren?\n\nGib dein <b>Admin-Passwort</b> ein (60 Sekunden):`);
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith("/trust ")) {
      const ipToTrust = text.split(" ")[1]?.trim();
      if (!ipToTrust) {
        await reply(chatId, "❓ Verwendung: /trust [IP-Adresse]\nBeispiel: /trust 85.155.182.244");
        return NextResponse.json({ ok: true });
      }
      pendingConfirm.set(chatId, { action: `trust:${ipToTrust}`, expiresAt: Date.now() + 60_000 });
      await reply(chatId, `🔐 IP <code>${ipToTrust}</code> auf Whitelist setzen?\n\nGib dein <b>Admin-Passwort</b> ein (60 Sekunden):`);
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith("/untrust ")) {
      const ipToUntrust = text.split(" ")[1]?.trim();
      if (!ipToUntrust) {
        await reply(chatId, "❓ Verwendung: /untrust [IP-Adresse]\nBeispiel: /untrust 85.155.182.244");
        return NextResponse.json({ ok: true });
      }
      pendingConfirm.set(chatId, { action: `untrust:${ipToUntrust}`, expiresAt: Date.now() + 60_000 });
      await reply(chatId, `🔐 IP <code>${ipToUntrust}</code> von Whitelist entfernen?\n\nGib dein <b>Admin-Passwort</b> ein (60 Sekunden):`);
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/vorschlaege" || textLower === "/vorschläge") {
      const { getRecommendations, getAppliedOverrides } = await import("@/lib/analysis-engine/overrides-store");
      const [recs, applied] = await Promise.all([getRecommendations(), getAppliedOverrides()]);
      if (recs.length === 0 && Object.keys(applied).length === 0) {
        await reply(chatId, "ℹ️ Aktuell keine Vorschläge der Analysis Engine.\n(Neue Vorschläge kommen täglich 04:00 UTC nach dem Nacht-Backtest)");
        return NextResponse.json({ ok: true });
      }
      const lines: string[] = [];
      if (recs.length > 0) {
        lines.push("🔧 <b>Offene Vorschläge:</b>");
        for (const r of recs) {
          const isApplied = !!applied[r.symbol.toUpperCase()];
          lines.push(`• <b>${r.symbol}</b>${isApplied ? " ✅ ANGEWENDET" : ""} → ${r.suggestion.strategy} als ${r.suggestion.style}`);
          lines.push(`  ${r.reason}`);
          lines.push(`  ${r.evidence}`);
        }
        lines.push("");
        lines.push("Anwenden: /apply SYMBOL (Passwort nötig)");
      }
      const appliedKeys = Object.keys(applied);
      if (appliedKeys.length > 0) {
        lines.push("");
        lines.push("✅ <b>Aktive Overrides:</b>");
        for (const sym of appliedKeys) {
          const o = applied[sym];
          lines.push(`• ${sym}: ${o.strategy} als ${o.style} (seit ${telegramDatum(new Date(o.appliedAt))})`);
        }
        lines.push("Entfernen: /unapply SYMBOL");
      }
      await reply(chatId, lines.join("\n"));
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith("/apply ")) {
      const symbolToApply = text.split(" ")[1]?.trim();
      if (!symbolToApply) {
        await reply(chatId, "❓ Verwendung: /apply [SYMBOL]\nBeispiel: /apply GBPJPY");
        return NextResponse.json({ ok: true });
      }
      pendingConfirm.set(chatId, { action: `apply:${symbolToApply}`, expiresAt: Date.now() + 60_000 });
      await reply(chatId, `🔐 Override für <code>${symbolToApply.toUpperCase()}</code> anwenden?\n\nDas ändert Style/SL/TP für neue Trades dieses Symbols (30 Tage).\nGib dein <b>Admin-Passwort</b> ein (60 Sekunden):`);
      return NextResponse.json({ ok: true });
    }

    if (textLower.startsWith("/unapply ")) {
      const symbolToUnapply = text.split(" ")[1]?.trim();
      if (!symbolToUnapply) {
        await reply(chatId, "❓ Verwendung: /unapply [SYMBOL]\nBeispiel: /unapply GBPJPY");
        return NextResponse.json({ ok: true });
      }
      pendingConfirm.set(chatId, { action: `unapply:${symbolToUnapply}`, expiresAt: Date.now() + 60_000 });
      await reply(chatId, `🔐 Override für <code>${symbolToUnapply.toUpperCase()}</code> entfernen?\n\nGib dein <b>Admin-Passwort</b> ein (60 Sekunden):`);
      return NextResponse.json({ ok: true });
    }

    if (textLower === "/trusted") {
      const { getWhitelistedIPs } = await import("@/lib/security-watchdog/ip-blocklist");
      const list = await getWhitelistedIPs();
      if (list.length === 0) {
        await reply(chatId, "ℹ️ Keine IPs auf der Whitelist.");
      } else {
        const lines = list.map(e =>
          `🛡 <code>${e.ip}</code>\n   ${e.reason}\n   Seit: ${telegramZeit(new Date(e.addedAt))}`
        ).join("\n\n");
        await reply(chatId, `🛡 <b>Whitelist (${list.length} IPs):</b>\n\n${lines}`);
      }
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
