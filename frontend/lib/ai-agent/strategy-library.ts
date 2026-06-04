export type StrategyCategory =
  | "MOMENTUM"
  | "TREND"
  | "BREAKOUT"
  | "MEAN_REVERSION"
  | "SCALPING"
  | "NEWS_REACTION"
  | "LIQUIDITY"
  | "SMART_MONEY"
  | "VWAP"
  | "EMA"
  | "RSI"
  | "SUPPLY_DEMAND"
  | "MARKET_STRUCTURE";

export type StrategyLibraryItem = {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  markets: string[];
  timeframes: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  complexity: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  status: "ACTIVE" | "WATCH" | "RESEARCH" | "DISABLED";
  source: "SYSTEM_LIBRARY";
  baseScore: number;
  confidenceBoost: number;
  rules: string[];
};

export class StrategyLibrary {
  static getAll(): StrategyLibraryItem[] {
    return [
      {
        id: "strategy-momentum-continuation",
        name: "Momentum Continuation",
        category: "MOMENTUM",
        description:
          "Follows strong directional movement after confirmation of continuation.",
        markets: ["EURUSD", "XAUUSD", "NAS100", "USOIL"],
        timeframes: ["15m", "1h", "4h"],
        riskLevel: "MEDIUM",
        complexity: "INTERMEDIATE",
        status: "ACTIVE",
        source: "SYSTEM_LIBRARY",
        baseScore: 78,
        confidenceBoost: 3,
        rules: [
          "Trend direction confirmed",
          "Momentum candle present",
          "Pullback does not break structure",
          "Risk reward minimum 1:1",
        ],
      },
      {
        id: "strategy-trend-following",
        name: "Trend Following",
        category: "TREND",
        description:
          "Trades in the direction of the dominant trend using structure and continuation logic.",
        markets: ["EURUSD", "XAUUSD", "NAS100"],
        timeframes: ["1h", "4h", "1d"],
        riskLevel: "MEDIUM",
        complexity: "INTERMEDIATE",
        status: "WATCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 74,
        confidenceBoost: 2,
        rules: [
          "Higher highs or lower lows confirmed",
          "Trend direction aligned",
          "No major news conflict",
          "Stop loss behind structure",
        ],
      },
      {
        id: "strategy-breakout-expansion",
        name: "Breakout Expansion",
        category: "BREAKOUT",
        description:
          "Targets volatility expansion after a consolidation or key level break.",
        markets: ["NAS100", "XAUUSD", "EURUSD", "BTCUSD"],
        timeframes: ["5m", "15m", "1h"],
        riskLevel: "HIGH",
        complexity: "ADVANCED",
        status: "WATCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 72,
        confidenceBoost: 1,
        rules: [
          "Clear consolidation range",
          "Breakout candle closes outside range",
          "Volume or momentum confirmation",
          "Avoid false breakout conditions",
        ],
      },
      {
        id: "strategy-mean-reversion",
        name: "Mean Reversion",
        category: "MEAN_REVERSION",
        description:
          "Trades return toward fair value after overextension.",
        markets: ["EURUSD", "XAUUSD", "NAS100"],
        timeframes: ["15m", "1h"],
        riskLevel: "MEDIUM",
        complexity: "INTERMEDIATE",
        status: "WATCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 64,
        confidenceBoost: 0,
        rules: [
          "Price is extended from mean",
          "Momentum is weakening",
          "Support or resistance reaction appears",
          "Avoid strong trending conditions",
        ],
      },
      {
        id: "strategy-scalping-micro-momentum",
        name: "Micro Momentum Scalping",
        category: "SCALPING",
        description:
          "Short-term momentum trades with tight risk and fast exits.",
        markets: ["EURUSD", "NAS100", "XAUUSD"],
        timeframes: ["1m", "5m"],
        riskLevel: "HIGH",
        complexity: "ADVANCED",
        status: "RESEARCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 58,
        confidenceBoost: 0,
        rules: [
          "High liquidity session",
          "Spread acceptable",
          "Fast momentum confirmation",
          "Strict stop loss required",
        ],
      },
      {
        id: "strategy-news-reaction",
        name: "News Reaction Strategy",
        category: "NEWS_REACTION",
        description:
          "Trades controlled reactions after macroeconomic or market-moving news.",
        markets: ["EURUSD", "XAUUSD", "USOIL", "NAS100"],
        timeframes: ["1m", "5m", "15m"],
        riskLevel: "HIGH",
        complexity: "ADVANCED",
        status: "RESEARCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 55,
        confidenceBoost: 0,
        rules: [
          "News event identified",
          "Initial spike is complete",
          "Direction confirmation after volatility",
          "Risk reduced during event windows",
        ],
      },
      {
        id: "strategy-liquidity-sweep",
        name: "Liquidity Sweep Reversal",
        category: "LIQUIDITY",
        description:
          "Looks for stop runs above or below liquidity zones before reversal.",
        markets: ["EURUSD", "XAUUSD", "NAS100"],
        timeframes: ["5m", "15m", "1h"],
        riskLevel: "HIGH",
        complexity: "ADVANCED",
        status: "RESEARCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 62,
        confidenceBoost: 1,
        rules: [
          "Previous high or low swept",
          "Rejection candle confirmed",
          "Market structure shift appears",
          "Entry only after confirmation",
        ],
      },
      {
        id: "strategy-order-block",
        name: "Order Block Reaction",
        category: "SMART_MONEY",
        description:
          "Uses institutional supply/demand zones and market structure shift confirmation.",
        markets: ["EURUSD", "XAUUSD", "NAS100"],
        timeframes: ["15m", "1h", "4h"],
        riskLevel: "HIGH",
        complexity: "ADVANCED",
        status: "RESEARCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 60,
        confidenceBoost: 1,
        rules: [
          "Valid order block identified",
          "Liquidity taken before reaction",
          "Structure shift confirms direction",
          "Invalidation clearly defined",
        ],
      },
      {
        id: "strategy-vwap-reversion",
        name: "VWAP Reversion",
        category: "VWAP",
        description:
          "Uses VWAP as intraday fair value reference for controlled reversion trades.",
        markets: ["NAS100", "XAUUSD", "EURUSD"],
        timeframes: ["5m", "15m"],
        riskLevel: "MEDIUM",
        complexity: "INTERMEDIATE",
        status: "RESEARCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 61,
        confidenceBoost: 0,
        rules: [
          "Price extended from VWAP",
          "Session liquidity is sufficient",
          "Rejection signal appears",
          "Trade target near VWAP or partial mean",
        ],
      },
      {
        id: "strategy-ema-cross",
        name: "EMA Cross Trend Signal",
        category: "EMA",
        description:
          "Uses EMA alignment and crossovers as directional trend confirmation.",
        markets: ["EURUSD", "XAUUSD", "NAS100", "BTCUSD"],
        timeframes: ["15m", "1h", "4h"],
        riskLevel: "LOW",
        complexity: "BASIC",
        status: "WATCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 66,
        confidenceBoost: 1,
        rules: [
          "Fast EMA crosses slow EMA",
          "Price confirms direction",
          "Avoid choppy market",
          "Stop loss follows structure",
        ],
      },
      {
        id: "strategy-rsi-divergence",
        name: "RSI Divergence",
        category: "RSI",
        description:
          "Detects weakening momentum through divergence between price and RSI.",
        markets: ["EURUSD", "XAUUSD", "NAS100"],
        timeframes: ["15m", "1h"],
        riskLevel: "MEDIUM",
        complexity: "INTERMEDIATE",
        status: "RESEARCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 59,
        confidenceBoost: 0,
        rules: [
          "Price makes new extreme",
          "RSI fails to confirm",
          "Reversal structure appears",
          "Avoid strong trend continuation",
        ],
      },
      {
        id: "strategy-supply-demand",
        name: "Supply Demand Reaction",
        category: "SUPPLY_DEMAND",
        description:
          "Trades reactions from major supply and demand zones.",
        markets: ["EURUSD", "XAUUSD", "NAS100", "USOIL"],
        timeframes: ["1h", "4h", "1d"],
        riskLevel: "MEDIUM",
        complexity: "INTERMEDIATE",
        status: "WATCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 68,
        confidenceBoost: 1,
        rules: [
          "Clear supply or demand zone",
          "Reaction candle confirms interest",
          "Risk reward acceptable",
          "Avoid low-quality zones",
        ],
      },
      {
        id: "strategy-market-structure-shift",
        name: "Market Structure Shift",
        category: "MARKET_STRUCTURE",
        description:
          "Uses break of structure and change of character to identify directional shifts.",
        markets: ["EURUSD", "XAUUSD", "NAS100"],
        timeframes: ["5m", "15m", "1h", "4h"],
        riskLevel: "MEDIUM",
        complexity: "ADVANCED",
        status: "WATCH",
        source: "SYSTEM_LIBRARY",
        baseScore: 70,
        confidenceBoost: 2,
        rules: [
          "Structure break appears",
          "Previous liquidity area is respected",
          "Retest confirms new direction",
          "Invalidation below or above structure",
        ],
      },
    ];
  }

  static getActiveAndWatch() {
    return this.getAll().filter(
      (strategy) =>
        strategy.status === "ACTIVE" ||
        strategy.status === "WATCH"
    );
  }

  static getById(id: string) {
    return this.getAll().find(
      (strategy) => strategy.id === id
    );
  }

  static getByCategory(category: StrategyCategory) {
    return this.getAll().filter(
      (strategy) => strategy.category === category
    );
  }
}