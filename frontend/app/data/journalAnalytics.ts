import { trades } from "./trades";

type Trade = (typeof trades)[number];

const STORAGE_KEY = "ai-trading-journal-trades";

function getStoredTrades(): Trade[] {
  if (typeof window === "undefined") {
    return trades;
  }

  const savedTrades = localStorage.getItem(STORAGE_KEY);

  if (!savedTrades) {
    return trades;
  }

  try {
    return JSON.parse(savedTrades);
  } catch {
    return trades;
  }
}

function getTotalProfit(data: Trade[]) {
  return data.reduce((sum, trade) => sum + trade.profitLoss, 0);
}

function getWinrate(data: Trade[]) {
  const closed = data.filter((trade) => trade.status === "CLOSED");
  if (closed.length === 0) return 0;

  const wins = closed.filter((trade) => trade.result === "WIN").length;
  return Math.round((wins / closed.length) * 100);
}

function getAverageWinner(data: Trade[]) {
  const winners = data.filter((trade) => trade.profitLoss > 0);
  if (winners.length === 0) return 0;

  return Math.round(
    winners.reduce((sum, trade) => sum + trade.profitLoss, 0) /
      winners.length
  );
}

function getAverageLoser(data: Trade[]) {
  const losers = data.filter((trade) => trade.profitLoss < 0);
  if (losers.length === 0) return 0;

  return Math.round(
    losers.reduce((sum, trade) => sum + trade.profitLoss, 0) /
      losers.length
  );
}

function getProfitFactor(data: Trade[]) {
  const grossProfit = data
    .filter((trade) => trade.profitLoss > 0)
    .reduce((sum, trade) => sum + trade.profitLoss, 0);

  const grossLoss = Math.abs(
    data
      .filter((trade) => trade.profitLoss < 0)
      .reduce((sum, trade) => sum + trade.profitLoss, 0)
  );

  if (grossLoss === 0) {
    return grossProfit > 0 ? grossProfit : 0;
  }

  return Number((grossProfit / grossLoss).toFixed(2));
}

function getMarketPerformance(data: Trade[]) {
  const marketMap = new Map<string, number>();

  data.forEach((trade) => {
    const currentValue = marketMap.get(trade.market) ?? 0;
    marketMap.set(trade.market, currentValue + trade.profitLoss);
  });

  return Array.from(marketMap.entries())
    .map(([market, profitLoss]) => ({
      market,
      profitLoss,
    }))
    .sort((a, b) => b.profitLoss - a.profitLoss);
}

export function showJournalAnalytics() {
  const journalTrades = getStoredTrades();

  const totalTrades = journalTrades.length;
  const openTrades = journalTrades.filter((trade) => trade.status === "OPEN");
  const closedTrades = journalTrades.filter((trade) => trade.status === "CLOSED");

  const totalProfit = getTotalProfit(journalTrades);
  const winrate = getWinrate(journalTrades);
  const averageWinner = getAverageWinner(journalTrades);
  const averageLoser = getAverageLoser(journalTrades);
  const profitFactor = getProfitFactor(journalTrades);

  const marketPerformance = getMarketPerformance(journalTrades);
  const bestMarket = marketPerformance[0];
  const worstMarket = marketPerformance[marketPerformance.length - 1];

  const bestTrade = [...journalTrades].sort(
    (a, b) => b.profitLoss - a.profitLoss
  )[0];

  const worstTrade = [...journalTrades].sort(
    (a, b) => a.profitLoss - b.profitLoss
  )[0];

  let recommendation = "Noch nicht genug Daten für eine klare Empfehlung.";

  if (closedTrades.length >= 3) {
    if (profitFactor >= 2 && winrate >= 60) {
      recommendation =
        "Deine Performance ist stark. Fokus: Disziplin beibehalten, Risiko nicht erhöhen und erfolgreiche Märkte weiter priorisieren.";
    } else if (profitFactor >= 1.2 && winrate >= 50) {
      recommendation =
        "Deine Performance ist solide, aber noch ausbaufähig. Fokus: bessere Setups filtern und schwächere Märkte reduzieren.";
    } else {
      recommendation =
        "Deine Performance braucht Optimierung. Fokus: Verlusttrades analysieren, Risiko reduzieren und nur klare A+ Setups traden.";
    }
  }

  return `📊 AI Journal Analytics

Überblick:
Total Trades: ${totalTrades}
Open Trades: ${openTrades.length}
Closed Trades: ${closedTrades.length}

Performance:
Total Profit/Loss: ${totalProfit} CHF
Winrate: ${winrate}%
Profit Factor: ${profitFactor}

Durchschnitt:
Average Winner: ${averageWinner} CHF
Average Loser: ${averageLoser} CHF

Bester Markt:
${bestMarket ? `${bestMarket.market} (${bestMarket.profitLoss} CHF)` : "Keine Daten"}

Schwächster Markt:
${worstMarket ? `${worstMarket.market} (${worstMarket.profitLoss} CHF)` : "Keine Daten"}

Best Trade:
${bestTrade ? `${bestTrade.market} ${bestTrade.direction} (${bestTrade.profitLoss} CHF)` : "Keine Daten"}

Worst Trade:
${worstTrade ? `${worstTrade.market} ${worstTrade.direction} (${worstTrade.profitLoss} CHF)` : "Keine Daten"}

AI Empfehlung:
${recommendation}`;
}