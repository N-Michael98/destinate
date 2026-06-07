import type {
  MultiTimeframeTradingStyleAnalysisReport,
  SymbolMultiTimeframeAnalysis,
  Timeframe,
  TimeframeAnalysisNode,
  TimeframeBias,
  TradingStyle,
  TradingStyleDecision,
} from "./multi-timeframe-types";

const analysisOrder: Timeframe[] = [
  "1M",
  "1W",
  "1D",
  "4H",
  "2H",
  "1H",
  "15M",
  "5M",
  "1M_ENTRY",
];

function createNode(
  timeframe: Timeframe,
  order: number,
  bias: TimeframeBias,
  trendStrength: number,
  structureScore: number,
  liquidityScore: number,
  momentumScore: number,
): TimeframeAnalysisNode {
  return {
    timeframe,
    order,
    bias,
    trendStrength,
    structureScore,
    liquidityScore,
    momentumScore,
    reason: `${timeframe} bias is ${bias} with trend strength ${trendStrength}, structure score ${structureScore}, liquidity score ${liquidityScore} and momentum score ${momentumScore}.`,
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function majorityBias(nodes: TimeframeAnalysisNode[]): TimeframeBias {
  const bullish = nodes.filter((node) => node.bias === "BULLISH").length;
  const bearish = nodes.filter((node) => node.bias === "BEARISH").length;

  if (bullish > bearish) return "BULLISH";
  if (bearish > bullish) return "BEARISH";
  return "NEUTRAL";
}

function directionFromBias(bias: TimeframeBias): "LONG" | "SHORT" | "NEUTRAL" {
  if (bias === "BULLISH") return "LONG";
  if (bias === "BEARISH") return "SHORT";
  return "NEUTRAL";
}

function buildStyleDecision(
  style: TradingStyle,
  nodes: TimeframeAnalysisNode[],
  higherContextBias: TimeframeBias,
): TradingStyleDecision {
  const styleBias = majorityBias(nodes);
  const confidenceScore = Math.round(
    average([
      average(nodes.map((node) => node.trendStrength)),
      average(nodes.map((node) => node.structureScore)),
      average(nodes.map((node) => node.momentumScore)),
    ]),
  );

  const liquidityRisk = average(nodes.map((node) => 100 - node.liquidityScore));
  const conflictRisk =
    higherContextBias !== "NEUTRAL" &&
    styleBias !== "NEUTRAL" &&
    higherContextBias !== styleBias
      ? 25
      : 0;

  const riskScore = Math.min(100, Math.round(liquidityRisk + conflictRisk));

  let status: TradingStyleDecision["status"] = "WAIT";

  if (styleBias === "NEUTRAL") {
    status = "WAIT";
  } else if (confidenceScore >= 65 && riskScore <= 45) {
    status = "APPROVED";
  } else if (confidenceScore < 50 || riskScore >= 70) {
    status = "BLOCKED";
  }

  const positionSizeMultiplier =
    style === "SCALPING"
      ? status === "APPROVED"
        ? 0.35
        : 0
      : style === "DAYTRADING"
        ? status === "APPROVED"
          ? 0.6
          : 0
        : status === "APPROVED"
          ? 0.8
          : 0;

  const holdingRule =
    style === "SCALPING"
      ? "No overnight hold. Fast exit. Use only lower-timeframe confirmation."
      : style === "DAYTRADING"
        ? "Intraday only. No swing hold unless higher timeframe confirms."
        : "Swing hold allowed only if 1M/1W/1D remain aligned.";

  const entryRule =
    style === "SCALPING"
      ? "Entry requires 15M setup plus 5M and 1M_ENTRY trigger."
      : style === "DAYTRADING"
        ? "Entry requires 4H/2H/1H context plus 15M confirmation."
        : "Entry requires 1M/1W/1D macro alignment plus 4H confirmation.";

  const reason =
    status === "APPROVED"
      ? `${style} setup approved. ${styleBias} bias is strong enough with acceptable risk.`
      : status === "BLOCKED"
        ? `${style} setup blocked because confidence is too low or risk/conflict is too high.`
        : `${style} setup waits for clearer confirmation.`;

  return {
    style,
    status,
    direction: directionFromBias(styleBias),
    confidenceScore,
    riskScore,
    relevantTimeframes: nodes.map((node) => node.timeframe),
    positionSizeMultiplier,
    holdingRule,
    entryRule,
    reason,
  };
}

function pickRecommendedStyle(
  decisions: TradingStyleDecision[],
): TradingStyle | "NONE" {
  const approved = decisions.filter((decision) => decision.status === "APPROVED");

  if (approved.length === 0) return "NONE";

  const priority: TradingStyle[] = ["SWING", "DAYTRADING", "SCALPING"];

  const best = priority.find((style) =>
    approved.some((decision) => decision.style === style),
  );

  return best ?? "NONE";
}

function buildSymbolAnalysis(
  symbol: string,
  nodes: TimeframeAnalysisNode[],
): SymbolMultiTimeframeAnalysis {
  const macroNodes = nodes.filter((node) =>
    ["1M", "1W", "1D"].includes(node.timeframe),
  );

  const swingNodes = nodes.filter((node) =>
    ["1M", "1W", "1D", "4H"].includes(node.timeframe),
  );

  const daytradingNodes = nodes.filter((node) =>
    ["1D", "4H", "2H", "1H", "15M"].includes(node.timeframe),
  );

  const scalpingNodes = nodes.filter((node) =>
    ["1H", "15M", "5M", "1M_ENTRY"].includes(node.timeframe),
  );

  const macroBias = majorityBias(macroNodes);
  const swingBias = majorityBias(swingNodes);
  const daytradingBias = majorityBias(daytradingNodes);
  const scalpingBias = majorityBias(scalpingNodes);
  const topDownBias = majorityBias(nodes);

  const styleDecisions = [
    buildStyleDecision("SWING", swingNodes, macroBias),
    buildStyleDecision("DAYTRADING", daytradingNodes, swingBias),
    buildStyleDecision("SCALPING", scalpingNodes, daytradingBias),
  ];

  const recommendedTradingStyle = pickRecommendedStyle(styleDecisions);

  const finalRecommendation =
    recommendedTradingStyle === "NONE"
      ? `${symbol}: No trading style approved. Wait for clearer multi-timeframe alignment.`
      : `${symbol}: Recommended style is ${recommendedTradingStyle}. Higher timeframe context remains visible but does not automatically block other styles.`;

  return {
    symbol,
    topDownBias,
    macroBias,
    swingBias,
    daytradingBias,
    scalpingBias,
    timeframeNodes: nodes,
    styleDecisions,
    recommendedTradingStyle,
    finalRecommendation,
  };
}

const goldNodes: TimeframeAnalysisNode[] = [
  createNode("1M", 1, "BEARISH", 72, 70, 66, 68),
  createNode("1W", 2, "BEARISH", 70, 68, 65, 66),
  createNode("1D", 3, "BEARISH", 64, 60, 58, 56),
  createNode("4H", 4, "NEUTRAL", 50, 54, 58, 52),
  createNode("2H", 5, "NEUTRAL", 52, 56, 60, 55),
  createNode("1H", 6, "BULLISH", 66, 68, 72, 70),
  createNode("15M", 7, "BULLISH", 74, 76, 78, 75),
  createNode("5M", 8, "BULLISH", 78, 80, 82, 79),
  createNode("1M_ENTRY", 9, "BULLISH", 80, 82, 85, 84),
];

const nasdaqNodes: TimeframeAnalysisNode[] = [
  createNode("1M", 1, "BULLISH", 76, 74, 70, 72),
  createNode("1W", 2, "BULLISH", 75, 73, 70, 71),
  createNode("1D", 3, "BULLISH", 72, 70, 68, 70),
  createNode("4H", 4, "BULLISH", 68, 66, 65, 64),
  createNode("2H", 5, "NEUTRAL", 55, 58, 60, 57),
  createNode("1H", 6, "BEARISH", 64, 62, 66, 65),
  createNode("15M", 7, "BEARISH", 70, 72, 75, 72),
  createNode("5M", 8, "BEARISH", 74, 76, 78, 75),
  createNode("1M_ENTRY", 9, "BEARISH", 78, 80, 82, 80),
];

const spxNodes: TimeframeAnalysisNode[] = [
  createNode("1M", 1, "NEUTRAL", 54, 55, 60, 52),
  createNode("1W", 2, "NEUTRAL", 52, 54, 58, 50),
  createNode("1D", 3, "NEUTRAL", 50, 52, 56, 50),
  createNode("4H", 4, "NEUTRAL", 48, 50, 54, 49),
  createNode("2H", 5, "NEUTRAL", 50, 52, 55, 51),
  createNode("1H", 6, "NEUTRAL", 49, 51, 55, 50),
  createNode("15M", 7, "NEUTRAL", 50, 52, 55, 50),
  createNode("5M", 8, "NEUTRAL", 50, 52, 55, 50),
  createNode("1M_ENTRY", 9, "NEUTRAL", 50, 52, 55, 50),
];

export function getMultiTimeframeTradingStyleAnalysisReport(): MultiTimeframeTradingStyleAnalysisReport {
  const symbols = [
    buildSymbolAnalysis("XAUUSD", goldNodes),
    buildSymbolAnalysis("NAS100", nasdaqNodes),
    buildSymbolAnalysis("SPX500", spxNodes),
  ];

  const approvedScalpingSetups = symbols.reduce(
    (sum, symbol) =>
      sum +
      symbol.styleDecisions.filter(
        (decision) => decision.style === "SCALPING" && decision.status === "APPROVED",
      ).length,
    0,
  );

  const approvedDaytradingSetups = symbols.reduce(
    (sum, symbol) =>
      sum +
      symbol.styleDecisions.filter(
        (decision) => decision.style === "DAYTRADING" && decision.status === "APPROVED",
      ).length,
    0,
  );

  const approvedSwingSetups = symbols.reduce(
    (sum, symbol) =>
      sum +
      symbol.styleDecisions.filter(
        (decision) => decision.style === "SWING" && decision.status === "APPROVED",
      ).length,
    0,
  );

  const blockedSetups = symbols.reduce(
    (sum, symbol) =>
      sum + symbol.styleDecisions.filter((decision) => decision.status === "BLOCKED").length,
    0,
  );

  const recommendation =
    approvedScalpingSetups > 0
      ? "Scalping opportunities exist even when higher timeframe styles are blocked. Route approved scalps separately with reduced size and fast exit logic."
      : approvedDaytradingSetups > 0 || approvedSwingSetups > 0
        ? "Higher timeframe opportunities exist. Route approved styles to Portfolio Brain with matching holding rules."
        : "No style is approved. Wait for clearer alignment.";

  return {
    version: "V11.9.0",
    status: "READY",
    mode: "SIMULATION",
    analysisOrder,
    totalSymbols: symbols.length,
    approvedScalpingSetups,
    approvedDaytradingSetups,
    approvedSwingSetups,
    blockedSetups,
    symbols,
    systemRule:
      "Top-down analysis always starts from the biggest timeframe down to the smallest. Higher timeframe bias informs context but does not automatically block independent scalping, daytrading or swing decisions.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
