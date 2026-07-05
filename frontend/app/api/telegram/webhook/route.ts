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

      if (pending.action.startsWith("unblock:")) {
        const ipToUnblock = pending.action.split(":")[1];
        const { unblockIP, whitelistIP } = await import("@/lib/security-watchdog/ip-blocklist");
        await unblockIP(ipToUnblock);
        await whitelistIP(ipToUnblock, "Auto-Whitelist nach /unblock");
        await reply(chatId, `✅ IP <code>${ipToUnblock}</code> freigeschaltet + auf Whitelist.\n\n🛡 Watchdog wird diese IP nicht mehr automatisch sperren.`);
        await sendTelegram(`🔓 <b>IP freigegeben + Whitelist</b>\n\nIP: <code>${ipToUnblock}</code>\nFreigegeben von: ${name}\n🛡 Auf Whitelist — kein Auto-Block mehr\n🕐 ${new Date().toLocaleString("de-CH")}`);
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
        await sendTelegram(`🚫 <b>IP manuell gesperrt</b>\n\nIP: <code>${ipToBlock}</code>\nGesperrt von: ${name} (PERMANENT)\n🕐 ${new Date().toLocaleString("de-CH")}`);
      } else if (pending.action.startsWith("trust:")) {
        const ipToTrust = pending.action.split(":")[1];
        const { whitelistIP } = await import("@/lib/security-watchdog/ip-blocklist");
        await whitelistIP(ipToTrust, `Manuell vertraut von Admin via Telegram`);
        await reply(chatId, `🛡 IP <code>${ipToTrust}</code> auf Whitelist.\n\nWatchdog wird diese IP nie automatisch sperren.`);
        await sendTelegram(`🛡 <b>IP auf Whitelist</b>\n\nIP: <code>${ipToTrust}</code>\nHinzugefügt von: ${name}\n🕐 ${new Date().toLocaleString("de-CH")}`);
      } else if (pending.action.startsWith("untrust:")) {
        const ipToUntrust = pending.action.split(":")[1];
        const { unwhitelistIP } = await import("@/lib/security-watchdog/ip-blocklist");
        await unwhitelistIP(ipToUntrust);
        await reply(chatId, `⚠️ IP <code>${ipToUntrust}</code> von Whitelist entfernt.\n\nWatchdog kann diese IP jetzt wieder automatisch sperren.`);
        await sendTelegram(`⚠️ <b>IP von Whitelist entfernt</b>\n\nIP: <code>${ipToUntrust}</code>\nEntfernt von: ${name}\n🕐 ${new Date().toLocaleString("de-CH")}`);
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

<b>System-Befehle:</b>
/killswitch — Vollständiger Shutdown (Passwort nötig)
/ks — Kurzform für /killswitch
/reset — System reaktivieren (Passwort nötig)
/status — Aktueller System Status

<b>IP-Verwaltung:</b>
/blocked — Alle gesperrten IPs anzeigen
/block [ip] — IP manuell PERMANENT sperren (Passwort nötig)
/unblock [ip] — IP freischalten + Whitelist (Passwort nötig)
/trusted — Alle Whitelist-IPs anzeigen
/trust [ip] — IP auf Whitelist (Watchdog blockt nie)
/untrust [ip] — IP von Whitelist entfernen

<b>Analysis Engine (Lern-System):</b>
/vorschlaege — Verbesserungs-Vorschläge anzeigen
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
          `${e.permanent ? "🔴 PERMANENT" : "⏱ 72h"} <code>${e.ip}</code>\n   ${e.reason.slice(0, 60)}\n   Seit: ${new Date(e.blockedAt).toLocaleString("de-CH")}`
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
          lines.push(`• ${sym}: ${o.strategy} als ${o.style} (seit ${new Date(o.appliedAt).toLocaleDateString("de-CH")})`);
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
          `🛡 <code>${e.ip}</code>\n   ${e.reason}\n   Seit: ${new Date(e.addedAt).toLocaleString("de-CH")}`
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
