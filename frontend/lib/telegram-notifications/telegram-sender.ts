/**
 * Simple Telegram sender — reads BOT_TOKEN + CHAT_ID from Railway env vars.
 * No configuration needed in UI, works immediately after env vars are set.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID ?? "";

export function isTelegramConfigured(): boolean {
  return BOT_TOKEN.length > 10 && CHAT_ID.length > 3;
}

/**
 * Zeitstempel für JEDE Telegram-Nachricht (27.09.).
 *
 * ── DER FEHLER, GEMESSEN AM SCREENSHOT ──────────────────────────────────
 * Auf `/status` antwortete der Bot mit „27.9.2026, 12:48:11" — Telegram
 * zeigte dieselbe Nachricht um **14:48**. Zwei Stunden Unterschied, genau
 * der Sommerzeit-Versatz Zürichs.
 *
 * `toLocaleString("de-CH")` OHNE `timeZone` formatiert in der Zeitzone des
 * PROZESSES. Auf Railway ist das UTC (`TZ` ist nirgends gesetzt). Vier
 * Stellen in dieser Datei gaben die Zone mit, die zwölf im Webhook und eine
 * im Test nicht — im selben Chat standen damit zwei verschiedene Zeiten für
 * denselben Moment.
 *
 * ── WARUM ES LOKAL NICHT AUFFÄLLT ───────────────────────────────────────
 * Auf einem Rechner, der ohnehin in Zürich steht, liefern beide Varianten
 * dasselbe. Ein lokaler Vergleich hätte „alles in Ordnung" gemeldet. Der
 * einzige Beleg war die Differenz im Screenshot.
 *
 * Die Zone steht deshalb AUSGESCHRIEBEN dabei (MEZ/MESZ, wechselt am 25.10.
 * von selbst). Eine Zeit ohne Zonenangabe ist genau die Falle, die dieses
 * Projekt am 22.09. zwei Monate lang getragen hat — dort beim Broker, hier
 * in der Anzeige.
 */
export const BERICHT_ZONE = "Europe/Zurich";

export function telegramZeit(d: Date = new Date()): string {
  return d.toLocaleString("de-CH", { timeZone: BERICHT_ZONE, timeZoneName: "short" });
}

/** Nur das Datum — für Tages-Zusammenfassungen. */
export function telegramDatum(d: Date = new Date()): string {
  return d.toLocaleDateString("de-CH", { timeZone: BERICHT_ZONE });
}

/**
 * Ein Alarmsystem, dessen Ausfall selbst nicht alarmiert (25.10.)
 *
 * ── DER BEFUND ──────────────────────────────────────────────────────────────
 *
 * `sendTelegram` gibt `Promise<boolean>` zurück — und dieser Wert wurde an
 * **keiner einzigen** der elf Aufrufstellen ausgewertet (nachgezählt). Dazu
 * hatte die Funktion **drei stille Ausgänge**:
 *
 *   if (!isTelegramConfigured()) return false;   // Token/Chat-ID fehlt
 *   return data.ok;                              // Telegram sagt nein
 *   } catch { return false; }                    // Netzfehler
 *
 * Keiner davon schrieb eine Zeile. Daran hängen ZEHN Module: der
 * Sicherheits-Watchdog, das KI-Tor-Alarmsystem, der Diagnose-Agent, der
 * Risiko- und der Orchestrator-Agent, die Tagesbilanz.
 *
 * **Das ganze Alarmsystem konnte lautlos tot sein.** Fehlt `TELEGRAM_BOT_TOKEN`
 * in Railway, kehrt jeder Alarm sofort und wortlos zurück — und man erfährt
 * vom Problem erst, wenn man es ohnehin schon sieht. Genau der Zustand, der
 * seit dem 27.09. als offener Punkt notiert war („TELEGRAM_CHAT_ID im
 * Ruhezustand prüfen").
 *
 * Und der Grund wurde weggeworfen: Telegram antwortet bei Fehlern mit
 * `{ ok: false, error_code: 400, description: "chat not found" }` — die
 * `description` sagt genau, was los ist, und landete im Nichts. Dieselbe
 * Fehlerklasse wie der verschluckte 502-Antwortkörper vom 22.09.
 *
 * ── WOHIN DIE MELDUNG GEHT ──────────────────────────────────────────────────
 *
 * Ins **Konsolen-Log**, nicht nach Telegram — der Kanal ist ja gerade der
 * defekte. Gedrosselt wie die beiden Schwestern (`syncAussetzerMelden`,
 * `reconnectMelden`): jeder Wechsel, ein Dauerzustand alle 30 Minuten. Eigener
 * Zustand, damit sich die drei Lagen nicht gegenseitig verdecken.
 */
export const TELEGRAM_MELDE_ABSTAND_MS = 30 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __telegram_lage__: { lage: string; seit: number; gemeldet: number } | undefined;
}

export function telegramFehlerMelden(
  lage: "ok" | "nicht-konfiguriert" | "abgelehnt" | "netzfehler",
  grund: string,
  jetzt: number = Date.now(),
): string | null {
  const vorher = global.__telegram_lage__;
  const gewechselt = !vorher || vorher.lage !== lage;
  if (gewechselt) {
    global.__telegram_lage__ = { lage, seit: jetzt, gemeldet: jetzt };
  } else if (jetzt - vorher.gemeldet >= TELEGRAM_MELDE_ABSTAND_MS) {
    global.__telegram_lage__ = { ...vorher, gemeldet: jetzt };
  } else {
    return null;
  }
  if (lage === "ok") {
    return gewechselt ? "[telegram] ✅ Versand geht wieder" : null;
  }
  const dauer = gewechselt ? 0 : Math.round((jetzt - vorher!.seit) / 60000);
  const was = lage === "nicht-konfiguriert"
    ? "TELEGRAM_BOT_TOKEN oder TELEGRAM_CHAT_ID fehlt in der Umgebung"
    : lage === "abgelehnt"
      ? `Telegram lehnt ab: ${grund || "ohne Grund"}`
      : `Netzfehler: ${grund || "ohne Grund"}`;
  return `[telegram] ⚠️ Versand fehlgeschlagen — ${was}`
    + `${dauer > 0 ? ` (seit ${dauer} Min)` : ""}. `
    + "Solange das so ist, kommt KEIN Alarm an: weder Killswitch noch "
    + "Zyklus-Absturz, KI-Tor-Ausfall oder Tagesbilanz.";
}

export async function sendTelegram(text: string): Promise<boolean> {
  if (!isTelegramConfigured()) {
    const m = telegramFehlerMelden("nicht-konfiguriert", "");
    if (m) console.error(m);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    });
    // Der GRUND steht in `description` — bis heute weggeworfen.
    const data = await res.json() as { ok: boolean; description?: string; error_code?: number };
    if (!data.ok) {
      const m = telegramFehlerMelden("abgelehnt",
        `${data.error_code ?? res.status} ${data.description ?? ""}`.trim());
      if (m) console.error(m);
      return false;
    }
    const m = telegramFehlerMelden("ok", "");
    if (m) console.log(m);
    return true;
  } catch (e) {
    const m = telegramFehlerMelden("netzfehler",
      e instanceof Error ? e.message : String(e));
    if (m) console.error(m);
    return false;
  }
}

// ── Trade notifications ───────────────────────────────────────────────────────

export async function notifyTradeExecuted(params: {
  symbol: string;
  direction: "BUY" | "SELL";
  size: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  broker: string;
  dealId?: string;
}): Promise<void> {
  const dir = params.direction === "BUY" ? "🟢 BUY" : "🔴 SELL";
  const rr = params.stopLoss > 0 && params.takeProfit > 0
    ? (Math.abs(params.takeProfit - params.entry) / Math.abs(params.entry - params.stopLoss)).toFixed(1)
    : "?";

  await sendTelegram(
`📈 <b>Trade ausgeführt</b>

${dir} <b>${params.symbol}</b>
🏦 Broker: ${params.broker}
📊 Grösse: ${params.size} Units
🎯 Entry: ${params.entry}
🛑 SL: ${params.stopLoss}
✅ TP: ${params.takeProfit}
⚖️ R:R = 1:${rr}
🤖 Confidence: ${params.confidence}%
🕐 ${telegramZeit()}`
  );
}

export async function notifyTradeClosed(params: {
  symbol: string;
  direction: "BUY" | "SELL";
  result: "WIN" | "LOSS" | "BREAKEVEN";
  profitLoss: number;
  currency: string;
  broker: string;
}): Promise<void> {
  const emoji = params.result === "WIN" ? "✅" : params.result === "LOSS" ? "❌" : "➖";
  const dir = params.direction === "BUY" ? "BUY" : "SELL";
  const plSign = params.profitLoss >= 0 ? "+" : "";

  await sendTelegram(
`${emoji} <b>Trade geschlossen — ${params.result}</b>

📉 ${params.symbol} ${dir}
🏦 Broker: ${params.broker}
💰 P&L: <b>${plSign}${params.profitLoss.toFixed(2)} ${params.currency}</b>
🕐 ${telegramZeit()}`
  );
}

export async function notifyBreakeven(params: {
  symbol: string;
  direction: "BUY" | "SELL";
  entry: number;
  broker: string;
}): Promise<void> {
  await sendTelegram(
`⚡ <b>Breakeven gesetzt</b>

${params.symbol} ${params.direction}
🏦 Broker: ${params.broker}
📍 SL → Entry: ${params.entry}
🕐 ${telegramZeit()}`
  );
}

export async function notifyDailySummary(params: {
  trades: number;
  wins: number;
  losses: number;
  totalPnL: number;
  currency: string;
  winRate: number;
}): Promise<void> {
  const emoji = params.totalPnL >= 0 ? "📈" : "📉";
  const plSign = params.totalPnL >= 0 ? "+" : "";

  await sendTelegram(
`${emoji} <b>Tages-Zusammenfassung</b>

📊 Trades: ${params.trades}
✅ Wins: ${params.wins} | ❌ Losses: ${params.losses}
🎯 Win Rate: ${params.winRate.toFixed(0)}%
💰 Gesamt P&L: <b>${plSign}${params.totalPnL.toFixed(2)} ${params.currency}</b>
🕐 ${telegramDatum()}`
  );
}
