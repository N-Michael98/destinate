import { getMarketUniverse, MarketUniverseSymbol } from "./market-universe";

export type SyncedMarketRegime =
  | "BULLISH"
  | "BEARISH"
  | "RANGING"
  | "VOLATILE";

export type MarketRegimeSyncItem = {
  symbol: string;
  displayName: string;
  assetClass: string;
  tradingViewSymbol: string;
  regime: SyncedMarketRegime;
  trendScore: number;
  volatilityScore: number;
  opportunityScore: number;
  strategyFit: string[];
  reason: string;
};

export type MarketRegimeSyncReport = {
  version: string;
  status: "READY";
  totalMarkets: number;
  bullishMarkets: number;
  bearishMarkets: number;
  rangingMarkets: number;
  volatileMarkets: number;
  topOpportunityMarkets: MarketRegimeSyncItem[];
  markets: MarketRegimeSyncItem[];
  updatedAt: string;
};

function calculateMockTrendScore(market: MarketUniverseSymbol): number {
  const baseByAssetClass: Record<string, number> = {
    COMMODITY: 42,
    FOREX: 55,
    INDEX: 68,
    CRYPTO: 40,
    STOCK: 60,
  };

  const base = baseByAssetClass[market.assetClass] ?? 50;

  const priorityAdjustment =
    market.priority >= 90 ? 8 : market.priority >= 80 ? 4 : 0;

  const bearishBias =
    market.symbol === "XAUUSD" || market.symbol === "BTCUSD" ? -18 : 0;

  const bullishBias =
    market.symbol === "NAS100" || market.symbol === "SPX500" ? 8 : 0;

  return Math.max(
    0,
    Math.min(100, base + priorityAdjustment + bearishBias + bullishBias)
  );
}

function calculateMockVolatilityScore(market: MarketUniverseSymbol): number {
  const volatilityByAssetClass: Record<string, number> = {
    COMMODITY: 72,
    FOREX: 45,
    INDEX: 58,
    CRYPTO: 82,
    STOCK: 55,
  };

  const base = volatilityByAssetClass[market.assetClass] ?? 50;

  const newsBoost = market.strategyFit.includes("NEWS") ? 10 : 0;
  const volatilityBoost = market.strategyFit.includes("VOLATILITY") ? 12 : 0;

  return Math.max(0, Math.min(100, base + newsBoost + volatilityBoost));
}

function classifyRegime(
  trendScore: number,
  volatilityScore: number
): SyncedMarketRegime {
  if (volatilityScore >= 82) return "VOLATILE";
  if (trendScore >= 60) return "BULLISH";
  if (trendScore <= 42) return "BEARISH";
  return "RANGING";
}

function calculateOpportunityScore(
  market: MarketUniverseSymbol,
  trendScore: number,
  volatilityScore: number,
  regime: SyncedMarketRegime
): number {
  const strategyBoost =
    regime === "BULLISH" && market.strategyFit.includes("TREND")
      ? 12
      : regime === "BEARISH" && market.strategyFit.includes("REVERSAL")
        ? 10
        : regime === "RANGING" && market.strategyFit.includes("MEAN_REVERSION")
          ? 10
          : regime === "VOLATILE" && market.strategyFit.includes("BREAKOUT")
            ? 10
            : 0;

  const stabilityPenalty = volatilityScore >= 85 ? 10 : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        market.priority * 0.35 +
          Math.abs(trendScore - 50) * 0.8 +
          strategyBoost -
          stabilityPenalty
      )
    )
  );
}

function buildReason(
  market: MarketUniverseSymbol,
  regime: SyncedMarketRegime,
  trendScore: number,
  volatilityScore: number,
  opportunityScore: number
): string {
  return `${market.symbol} classified as ${regime} using shared Market Universe data. Trend score ${trendScore}, volatility score ${volatilityScore}, opportunity score ${opportunityScore}.`;
}

export function buildMarketRegimeSyncReport(): MarketRegimeSyncReport {
  const universe = getMarketUniverse();

  const markets = universe.markets
    .filter((market) => market.enabled)
    .map((market) => {
      const trendScore = calculateMockTrendScore(market);
      const volatilityScore = calculateMockVolatilityScore(market);
      const regime = classifyRegime(trendScore, volatilityScore);
      const opportunityScore = calculateOpportunityScore(
        market,
        trendScore,
        volatilityScore,
        regime
      );

      return {
        symbol: market.symbol,
        displayName: market.displayName,
        assetClass: market.assetClass,
        tradingViewSymbol: market.tradingViewSymbol,
        regime,
        trendScore,
        volatilityScore,
        opportunityScore,
        strategyFit: market.strategyFit,
        reason: buildReason(
          market,
          regime,
          trendScore,
          volatilityScore,
          opportunityScore
        ),
      };
    });

  return {
    version: "V11.4.5",
    status: "READY",
    totalMarkets: markets.length,
    bullishMarkets: markets.filter((market) => market.regime === "BULLISH").length,
    bearishMarkets: markets.filter((market) => market.regime === "BEARISH").length,
    rangingMarkets: markets.filter((market) => market.regime === "RANGING").length,
    volatileMarkets: markets.filter((market) => market.regime === "VOLATILE").length,
    topOpportunityMarkets: [...markets]
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 4),
    markets,
    updatedAt: new Date().toISOString(),
  };
}