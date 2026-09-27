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

export async function sendTelegram(text: string): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    });
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch { return false; }
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
