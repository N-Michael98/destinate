import { markets } from "../data/markets";

export function createMarketAnalysis(marketName: string) {
  const market = markets.find((item) => item.name === marketName);
  if (!market) return "Markt wurde nicht gefunden.";

  return `${market.name} Analyse

Direction: ${market.direction}
Score: ${market.score}
Confidence: ${market.confidence}%
Trend: ${market.trend}
Risk: ${market.risk}
Risk/Reward: ${market.riskReward}
AI Rating: ${market.aiRating}

Trading Setup:
Entry: ${market.entry}
Stop Loss: ${market.stopLoss}
Take Profit: ${market.takeProfit}

Analyse:
${market.analysis.map((item) => `• ${item}`).join("\n")}

News:
${market.news.map((item) => `• ${item}`).join("\n")}`;
}

export function showBestOpportunity() {
  const bestMarket = [...markets].sort((a, b) => b.score - a.score)[0];

  return `🏆 Beste Trading Chance heute

${bestMarket.name}

Score: ${bestMarket.score}
Confidence: ${bestMarket.confidence}%
Direction: ${bestMarket.direction}
Trend: ${bestMarket.trend}
Risk: ${bestMarket.risk}
Risk/Reward: ${bestMarket.riskReward}
AI Rating: ${bestMarket.aiRating}

Trading Setup:
Entry: ${bestMarket.entry}
Stop Loss: ${bestMarket.stopLoss}
Take Profit: ${bestMarket.takeProfit}

Warum?

${bestMarket.analysis.map((item) => `• ${item}`).join("\n")}`;
}

export function compareMarkets(firstMarketName: string, secondMarketName: string) {
  const first = markets.find((item) => item.name === firstMarketName);
  const second = markets.find((item) => item.name === secondMarketName);

  if (!first || !second) return "Einer der Märkte wurde nicht gefunden.";

  const winner = first.score >= second.score ? first : second;

  return `⚔️ Marktvergleich

${first.name} vs ${second.name}

Score:
${first.name}: ${first.score}
${second.name}: ${second.score}

Confidence:
${first.name}: ${first.confidence}%
${second.name}: ${second.confidence}%

Trend:
${first.name}: ${first.trend}
${second.name}: ${second.trend}

Risk:
${first.name}: ${first.risk}
${second.name}: ${second.risk}

Risk/Reward:
${first.name}: ${first.riskReward}
${second.name}: ${second.riskReward}

AI Rating:
${first.name}: ${first.aiRating}
${second.name}: ${second.aiRating}

🏆 Gewinner nach Score: ${winner.name}`;
}

export function showMarketRanking() {
  const sortedMarkets = [...markets].sort((a, b) => b.score - a.score);

  return `🏅 Ranking der stärksten Märkte

${sortedMarkets
  .map(
    (market, index) =>
      `#${index + 1} ${market.name}
Score: ${market.score}
Confidence: ${market.confidence}%
Direction: ${market.direction}
Risk: ${market.risk}
Risk/Reward: ${market.riskReward}`
  )
  .join("\n\n")}`;
}

export function explainMarket(marketName: string) {
  const market = markets.find((item) => item.name === marketName);
  if (!market) return "Markt wurde nicht gefunden.";

  return `🧠 Warum ist ${market.name} ${market.trend}?

Direction: ${market.direction}
Trend: ${market.trend}
AI Rating: ${market.aiRating}
Confidence: ${market.confidence}%
Risk: ${market.risk}

Begründung:

${market.analysis.map((item) => `• ${item}`).join("\n")}

News Kontext:

${market.news.map((item) => `• ${item}`).join("\n")}`;
}

export function showBuyOpportunities() {
  const buyMarkets = [...markets]
    .filter(
      (market) =>
        market.direction === "BUY" &&
        market.score >= 80 &&
        market.confidence >= 80
    )
    .sort((a, b) => b.score - a.score);

  if (buyMarkets.length === 0) {
    return "Aktuell wurden keine starken Kaufchancen gefunden.";
  }

  return `🔥 Aktuelle Kaufchancen

Filter:
Direction = BUY
Score >= 80
Confidence >= 80

${buyMarkets
  .map(
    (market, index) =>
      `#${index + 1} ${market.name}
Score: ${market.score}
Confidence: ${market.confidence}%
Trend: ${market.trend}
Risk: ${market.risk}
Risk/Reward: ${market.riskReward}
AI Rating: ${market.aiRating}

Entry: ${market.entry}
Stop Loss: ${market.stopLoss}
Take Profit: ${market.takeProfit}`
  )
  .join("\n\n")}`;
}

export function showSellOpportunities() {
  const sellMarkets = [...markets]
    .filter(
      (market) =>
        market.direction === "SELL" &&
        market.score >= 80 &&
        market.confidence >= 80
    )
    .sort((a, b) => b.score - a.score);

  if (sellMarkets.length === 0) {
    return "Aktuell wurden keine starken Verkaufschancen gefunden.";
  }

  return `🚨 Aktuelle Verkaufschancen

Filter:
Direction = SELL
Score >= 80
Confidence >= 80

${sellMarkets
  .map(
    (market, index) =>
      `#${index + 1} ${market.name}
Score: ${market.score}
Confidence: ${market.confidence}%
Trend: ${market.trend}
Risk: ${market.risk}
Risk/Reward: ${market.riskReward}
AI Rating: ${market.aiRating}

Entry: ${market.entry}
Stop Loss: ${market.stopLoss}
Take Profit: ${market.takeProfit}`
  )
  .join("\n\n")}`;
}

export function showAIWatchlist() {
  const sortedByScore = [...markets].sort((a, b) => b.score - a.score);

  const bestBuy = [...markets]
    .filter((market) => market.direction === "BUY")
    .sort((a, b) => b.score - a.score)[0];

  const bestSell = [...markets]
    .filter((market) => market.direction === "SELL")
    .sort((a, b) => b.score - a.score)[0];

  const highestConfidence = [...markets].sort(
    (a, b) => b.confidence - a.confidence
  )[0];

  const highestRisk = [...markets].find((market) => market.risk === "High");

  const topThree = sortedByScore.slice(0, 3);

  return `⭐ AI Watchlist

🏆 Beste Kaufchance
${bestBuy ? bestBuy.name : "Keine Kaufchance gefunden"}

🚨 Beste Verkaufschance
${bestSell ? bestSell.name : "Keine Verkaufschance gefunden"}

🎯 Höchste Confidence
${highestConfidence.name} (${highestConfidence.confidence}%)

⚠️ Höchstes Risiko
${highestRisk ? highestRisk.name : "Kein High-Risk Markt gefunden"}

📈 Top 3 Märkte

${topThree
  .map(
    (market, index) =>
      `#${index + 1} ${market.name}
Score: ${market.score}
Confidence: ${market.confidence}%
Direction: ${market.direction}
Risk: ${market.risk}
Risk/Reward: ${market.riskReward}`
  )
  .join("\n\n")}`;
}

export function showDailyBriefing() {
  const buyCount = markets.filter((market) => market.direction === "BUY").length;
  const sellCount = markets.filter((market) => market.direction === "SELL").length;
  const neutralCount = markets.filter((market) => market.direction === "NEUTRAL").length;

  const topOpportunity = [...markets].sort((a, b) => b.score - a.score)[0];

  const bestSell = [...markets]
    .filter((market) => market.direction === "SELL")
    .sort((a, b) => b.score - a.score)[0];

  const highestConfidence = [...markets].sort(
    (a, b) => b.confidence - a.confidence
  )[0];

  const highestRisk = [...markets].find((market) => market.risk === "High");

  return `📊 Daily Market Briefing

Markets Scanned: ${markets.length}

BUY Markets: ${buyCount}
SELL Markets: ${sellCount}
NEUTRAL Markets: ${neutralCount}

🏆 Top Opportunity
${topOpportunity.name}
Score: ${topOpportunity.score}
Confidence: ${topOpportunity.confidence}%
Direction: ${topOpportunity.direction}

🚨 Beste Sell Chance
${bestSell ? bestSell.name : "Keine Sell Chance gefunden"}

🎯 Höchste Confidence
${highestConfidence.name} (${highestConfidence.confidence}%)

⚠️ Höchstes Risiko
${highestRisk ? highestRisk.name : "Kein High-Risk Markt gefunden"}

📈 Fokus heute

• ${topOpportunity.name} beobachten
• ${bestSell ? `${bestSell.name} als Sell-Setup im Blick behalten` : "Keine starke Sell-Chance aktuell"}
• ${highestRisk ? `${highestRisk.name} wegen hoher Unsicherheit vorsichtig behandeln` : "Keine High-Risk Märkte aktuell"}`;
}

export function processSmartPrompt(input: string) {
  const prompt = input.toLowerCase();

  if (prompt.includes("daily") || prompt.includes("briefing")) {
    return showDailyBriefing();
  }

  if (prompt.includes("watchlist")) {
    return showAIWatchlist();
  }

  if (prompt.includes("kaufchancen") || prompt.includes("buy")) {
    return showBuyOpportunities();
  }

  if (prompt.includes("verkaufschancen") || prompt.includes("sell")) {
    return showSellOpportunities();
  }

  if (prompt.includes("ranking") || prompt.includes("stärkste")) {
    return showMarketRanking();
  }

  if (prompt.includes("beste chance") || prompt.includes("top opportunity")) {
    return showBestOpportunity();
  }

  if (prompt.includes("vergleich") || prompt.includes("vergleiche")) {
    return compareMarkets("Gold", "WTI Crude Oil");
  }

  if (prompt.includes("warum") && prompt.includes("gold")) {
    return explainMarket("Gold");
  }

  if (prompt.includes("gold")) {
    return createMarketAnalysis("Gold");
  }

  if (prompt.includes("wti") || prompt.includes("crude")) {
    return createMarketAnalysis("WTI Crude Oil");
  }

  if (prompt.includes("nas100")) {
    return createMarketAnalysis("NAS100");
  }

  if (prompt.includes("eurusd")) {
    return createMarketAnalysis("EURUSD");
  }

  return "Ich habe deine Frage erhalten. Die echte GPT/Claude-Antwort wird später über die API verbunden. Aktuell kann ich bereits: Daily Briefing, Watchlist, Kaufchancen, Verkaufschancen, Ranking, Marktvergleich und Einzelmarktanalysen.";
}