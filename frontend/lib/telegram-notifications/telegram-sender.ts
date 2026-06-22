/**
 * Simple Telegram sender — reads BOT_TOKEN + CHAT_ID from Railway env vars.
 * No configuration needed in UI, works immediately after env vars are set.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID ?? "";

export function isTelegramConfigured(): boolean {
  return BOT_TOKEN.length > 10 && CHAT_ID.length > 3;
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
🕐 ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`
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
🕐 ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`
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
🕐 ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`
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
🕐 ${new Date().toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}`
  );
}
