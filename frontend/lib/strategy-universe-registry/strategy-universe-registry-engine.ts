import { TradingStyle } from "../smart-broker-selection";
import { MarketCategory } from "../broker-performance-memory";

import {
  StrategyMarketCoverage,
  StrategyUniverseItem,
  StrategyUniverseRegistryReport,
  StrategyUniverseRegistryStatus,
} from "./strategy-universe-registry-types";

const VERSION = "V12.9.2" as const;

function buildStrategyUniverse(): StrategyUniverseItem[] {
  return [
    {
      strategyId: "strat-liquidity-sweep-scalping",
      strategyType: "LIQUIDITY_SWEEP_SCALPING",
      strategyName: "Liquidity Sweep Scalping",
      description:
        "Scalping strategy focused on liquidity grabs, stop hunts and fast reversal entries.",
      enabled: true,
      status: "ACTIVE",
      complexity: "INSTITUTIONAL",
      preferredMarkets: ["GOLD", "INDICES", "FOREX"],
      preferredSymbols: ["XAUUSD", "NAS100", "EURUSD"],
      supportedTradingStyles: ["SCALPING"],
      timeHorizon: "INTRADAY",
      requiredTimeframes: ["15M", "5M", "1M"],
      signalInputs: ["Liquidity Sweep", "Stop Hunt", "Reversal Wick"],
      confirmationInputs: ["Volume Spike", "Structure Shift", "Retest"],
      riskTags: ["High speed execution", "Spread sensitive", "Slippage sensitive"],
      brokerSensitivity: "HIGH",
      testPriority: 95,
      notes: [
        "Best tested on Gold and volatile index sessions.",
        "Requires low latency and tight spread broker conditions.",
      ],
    },
    {
      strategyId: "strat-news-volatility-scalping",
      strategyType: "NEWS_VOLATILITY_SCALPING",
      strategyName: "News Volatility Scalping",
      description:
        "Fast news-reaction strategy for high volatility spikes and post-news continuation or reversal.",
      enabled: true,
      status: "ACTIVE",
      complexity: "INSTITUTIONAL",
      preferredMarkets: ["GOLD", "FOREX", "INDICES"],
      preferredSymbols: ["XAUUSD", "EURUSD", "NAS100"],
      supportedTradingStyles: ["SCALPING"],
      timeHorizon: "INTRADAY",
      requiredTimeframes: ["15M", "5M", "1M"],
      signalInputs: ["High Impact News", "Volatility Expansion", "Spread Check"],
      confirmationInputs: ["Post-News Structure", "Momentum Continuation", "Liquidity Reaction"],
      riskTags: ["News risk", "Spread expansion", "Execution delay risk"],
      brokerSensitivity: "HIGH",
      testPriority: 90,
      notes: [
        "Should stay simulation-only until real news spread behavior is measured.",
        "Broker choice is extremely important for this strategy.",
      ],
    },
    {
      strategyId: "strat-breakout-daytrading",
      strategyType: "BREAKOUT_DAYTRADING",
      strategyName: "Breakout Daytrading",
      description:
        "Daytrading strategy focused on confirmed breakouts from key ranges, sessions and structure levels.",
      enabled: true,
      status: "ACTIVE",
      complexity: "MEDIUM",
      preferredMarkets: ["INDICES", "FOREX", "GOLD"],
      preferredSymbols: ["NAS100", "EURUSD", "XAUUSD"],
      supportedTradingStyles: ["DAYTRADING"],
      timeHorizon: "INTRADAY",
      requiredTimeframes: ["4H", "1H", "15M", "5M"],
      signalInputs: ["Range Break", "Session High/Low Break", "Momentum Candle"],
      confirmationInputs: ["Retest", "Volume Confirmation", "Market Regime Alignment"],
      riskTags: ["False breakout risk", "Momentum exhaustion"],
      brokerSensitivity: "MEDIUM",
      testPriority: 85,
      notes: [
        "Works best when market regime confirms expansion.",
        "Should be tested on NAS100 and EURUSD first.",
      ],
    },
    {
      strategyId: "strat-trend-pullback-swing",
      strategyType: "TREND_PULLBACK_SWING",
      strategyName: "Trend Pullback Swing",
      description:
        "Swing strategy focused on trend continuation after pullbacks into structure, moving averages or demand/supply.",
      enabled: true,
      status: "ACTIVE",
      complexity: "MEDIUM",
      preferredMarkets: ["FOREX", "GOLD", "INDICES"],
      preferredSymbols: ["EURUSD", "XAUUSD", "NAS100"],
      supportedTradingStyles: ["SWING"],
      timeHorizon: "MULTI_DAY",
      requiredTimeframes: ["1M", "1W", "1D", "4H"],
      signalInputs: ["Trend Bias", "Pullback Zone", "Continuation Structure"],
      confirmationInputs: ["Higher Low", "Lower High", "Break of Structure"],
      riskTags: ["Overnight risk", "Macro news risk"],
      brokerSensitivity: "MEDIUM",
      testPriority: 88,
      notes: [
        "Useful for slower trade setups with lower execution sensitivity.",
        "Should combine with macro and multi-timeframe bias.",
      ],
    },
    {
      strategyId: "strat-mean-reversion-daytrading",
      strategyType: "MEAN_REVERSION_DAYTRADING",
      strategyName: "Mean Reversion Daytrading",
      description:
        "Daytrading strategy focused on stretched price moves returning toward fair value, VWAP or session mean.",
      enabled: true,
      status: "ACTIVE",
      complexity: "MEDIUM",
      preferredMarkets: ["FOREX", "INDICES", "GOLD"],
      preferredSymbols: ["EURUSD", "NAS100", "XAUUSD"],
      supportedTradingStyles: ["DAYTRADING"],
      timeHorizon: "INTRADAY",
      requiredTimeframes: ["1H", "15M", "5M"],
      signalInputs: ["Deviation From Mean", "VWAP Distance", "Exhaustion Candle"],
      confirmationInputs: ["Momentum Slowdown", "Reclaim Level", "Range Context"],
      riskTags: ["Trend continuation risk", "Catching falling knife risk"],
      brokerSensitivity: "LOW",
      testPriority: 78,
      notes: [
        "Should only run in range or exhaustion market regimes.",
        "Needs strong market regime filter.",
      ],
    },
    {
      strategyId: "strat-orderblock-retest",
      strategyType: "TREND_PULLBACK_SWING",
      strategyName: "Orderblock Retest Strategy",
      description:
        "Structure-based strategy using institutional orderblock zones for pullback entries.",
      enabled: true,
      status: "ACTIVE",
      complexity: "HIGH",
      preferredMarkets: ["GOLD", "FOREX", "INDICES"],
      preferredSymbols: ["XAUUSD", "EURUSD", "NAS100"],
      supportedTradingStyles: ["DAYTRADING", "SWING"],
      timeHorizon: "MULTI_DAY",
      requiredTimeframes: ["1D", "4H", "1H", "15M"],
      signalInputs: ["Orderblock Zone", "Displacement", "Return To Origin"],
      confirmationInputs: ["Reaction Candle", "Structure Shift", "Invalidation Respect"],
      riskTags: ["Zone invalidation", "Delayed entry risk"],
      brokerSensitivity: "MEDIUM",
      testPriority: 84,
      notes: [
        "Can be tested as a subtype of Trend Pullback until separate strategy type is created.",
        "Useful for Gold, Forex and indices.",
      ],
    },
    {
      strategyId: "strat-fvg-rebalance",
      strategyType: "MEAN_REVERSION_DAYTRADING",
      strategyName: "Fair Value Gap Rebalance",
      description:
        "Price inefficiency strategy focused on FVG mitigation and rebalance behavior.",
      enabled: true,
      status: "ACTIVE",
      complexity: "HIGH",
      preferredMarkets: ["GOLD", "INDICES", "FOREX"],
      preferredSymbols: ["XAUUSD", "NAS100", "EURUSD"],
      supportedTradingStyles: ["SCALPING", "DAYTRADING"],
      timeHorizon: "INTRADAY",
      requiredTimeframes: ["1H", "15M", "5M", "1M"],
      signalInputs: ["Fair Value Gap", "Displacement", "Inefficiency"],
      confirmationInputs: ["Partial Fill", "Rejection", "Continuation Bias"],
      riskTags: ["Gap overfill risk", "Fast invalidation"],
      brokerSensitivity: "MEDIUM",
      testPriority: 82,
      notes: [
        "Can act as scalping or daytrading setup depending on timeframe.",
        "Should be combined with market structure and liquidity context.",
      ],
    },
    {
      strategyId: "strat-opening-range-breakout",
      strategyType: "BREAKOUT_DAYTRADING",
      strategyName: "Opening Range Breakout",
      description:
        "Session-based breakout strategy using the first range of a market session.",
      enabled: true,
      status: "ACTIVE",
      complexity: "LOW",
      preferredMarkets: ["INDICES", "GOLD", "FOREX"],
      preferredSymbols: ["NAS100", "XAUUSD", "EURUSD"],
      supportedTradingStyles: ["DAYTRADING"],
      timeHorizon: "INTRADAY",
      requiredTimeframes: ["1H", "15M", "5M"],
      signalInputs: ["Opening Range", "Range Break", "Session Momentum"],
      confirmationInputs: ["Volume", "Retest", "No Immediate Reversal"],
      riskTags: ["Fakeout risk", "Session volatility risk"],
      brokerSensitivity: "MEDIUM",
      testPriority: 80,
      notes: [
        "Especially relevant for NAS100.",
        "Needs session calendar integration later.",
      ],
    },
    {
      strategyId: "strat-support-resistance-reversal",
      strategyType: "MEAN_REVERSION_DAYTRADING",
      strategyName: "Support Resistance Reversal",
      description:
        "Classic technical reversal strategy at major support and resistance levels.",
      enabled: true,
      status: "ACTIVE",
      complexity: "LOW",
      preferredMarkets: ["FOREX", "GOLD", "INDICES"],
      preferredSymbols: ["EURUSD", "XAUUSD", "NAS100"],
      supportedTradingStyles: ["DAYTRADING", "SWING"],
      timeHorizon: "MULTI_DAY",
      requiredTimeframes: ["1D", "4H", "1H", "15M"],
      signalInputs: ["Support", "Resistance", "Reaction"],
      confirmationInputs: ["Rejection Wick", "Structure Shift", "Risk Reward"],
      riskTags: ["Level break risk", "Retest failure"],
      brokerSensitivity: "LOW",
      testPriority: 72,
      notes: [
        "Good baseline strategy for comparison.",
        "Should not be used without market context.",
      ],
    },
  ];
}

function buildMarketCoverage(
  strategies: StrategyUniverseItem[]
): StrategyMarketCoverage[] {
  const pairs = new Map<string, { market: MarketCategory; symbol: string }>();

  for (const strategy of strategies) {
    for (const market of strategy.preferredMarkets) {
      for (const symbol of strategy.preferredSymbols) {
        const key = `${market}-${symbol}`;
        pairs.set(key, { market, symbol });
      }
    }
  }

  return Array.from(pairs.values()).map(({ market, symbol }) => {
    const relatedStrategies = strategies.filter(
      (strategy) =>
        strategy.preferredMarkets.includes(market) &&
        strategy.preferredSymbols.includes(symbol)
    );

    const activeStrategies = relatedStrategies.filter(
      (strategy) => strategy.enabled && strategy.status === "ACTIVE"
    );

    const countByStyle = (style: TradingStyle) =>
      activeStrategies.filter((strategy) =>
        strategy.supportedTradingStyles.includes(style)
      ).length;

    return {
      market,
      symbol,
      totalStrategies: relatedStrategies.length,
      activeStrategies: activeStrategies.length,
      scalpingStrategies: countByStyle("SCALPING"),
      daytradingStrategies: countByStyle("DAYTRADING"),
      swingStrategies: countByStyle("SWING"),
      strategyNames: activeStrategies.map((strategy) => strategy.strategyName),
    };
  });
}

function resolveReportStatus(
  strategies: StrategyUniverseItem[]
): StrategyUniverseRegistryStatus {
  if (strategies.every((strategy) => !strategy.enabled)) {
    return "DISABLED";
  }

  if (strategies.some((strategy) => strategy.status === "WATCHLIST")) {
    return "WATCHLIST";
  }

  return "ACTIVE";
}

function buildRegistryNotes(strategies: StrategyUniverseItem[]): string[] {
  return strategies
    .sort((a, b) => b.testPriority - a.testPriority)
    .slice(0, 6)
    .map((strategy) => {
      return `${strategy.strategyName}: priority ${strategy.testPriority}, styles ${strategy.supportedTradingStyles.join(
        "/"
      )}, markets ${strategy.preferredMarkets.join("/")}.`;
    });
}

export function generateStrategyUniverseRegistryReport(): StrategyUniverseRegistryReport {
  const strategyUniverse = buildStrategyUniverse();
  const activeStrategies = strategyUniverse.filter(
    (strategy) => strategy.enabled && strategy.status === "ACTIVE"
  ).length;

  const watchlistStrategies = strategyUniverse.filter(
    (strategy) => strategy.status === "WATCHLIST"
  ).length;

  const disabledStrategies = strategyUniverse.filter(
    (strategy) => !strategy.enabled || strategy.status === "DISABLED"
  ).length;

  return {
    version: VERSION,
    status: resolveReportStatus(strategyUniverse),
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalStrategies: strategyUniverse.length,
    activeStrategies,
    watchlistStrategies,
    disabledStrategies,
    strategyUniverse,
    marketCoverage: buildMarketCoverage(strategyUniverse),
    summary:
      "Strategy Universe Registry created a centralized simulated strategy catalog for multi-strategy market testing and future broker-strategy matching.",
    registryNotes: buildRegistryNotes(strategyUniverse),
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
      registryMode: "SIMULATED_STRATEGY_UNIVERSE_REGISTRY",
    },
    createdAt: new Date().toISOString(),
  };
}
