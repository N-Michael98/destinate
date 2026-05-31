import { trades } from "./trades";

export function showOpenTrades() {
  const openTrades = trades.filter((trade) => trade.status === "OPEN");

  if (openTrades.length === 0) {
    return "Aktuell gibt es keine offenen Trades.";
  }

  return `📈 Offene Trades

${openTrades
  .map(
    (trade) =>
      `#${trade.id} ${trade.direction} ${trade.market}

Entry: ${trade.entry}
Stop Loss: ${trade.stopLoss}
Take Profit: ${trade.takeProfit}
Status: ${trade.status}`
  )
  .join("\n\n")}`;
}

export function showTradeSummary() {
  const openTrades = trades.filter((trade) => trade.status === "OPEN");
  const closedTrades = trades.filter((trade) => trade.status === "CLOSED");
  const longTrades = trades.filter((trade) => trade.direction === "LONG");
  const shortTrades = trades.filter((trade) => trade.direction === "SHORT");

  return `📊 Trade Summary

Total Trades: ${trades.length}
Open Trades: ${openTrades.length}
Closed Trades: ${closedTrades.length}

LONG Trades: ${longTrades.length}
SHORT Trades: ${shortTrades.length}`;
}