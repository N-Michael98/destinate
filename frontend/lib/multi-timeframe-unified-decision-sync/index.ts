import type {
  Direction,
  MultiTimeframeStyleInput,
  MultiTimeframeUnifiedDecisionSyncReport,
  TradingStyle,
  UnifiedStyleDecision,
} from "./multi-timeframe-unified-decision-types";

const styleInputs: MultiTimeframeStyleInput[] = [
  {
    symbol: "XAUUSD",
    style: "SWING",
    status: "WAIT",
    direction: "SHORT",
    confidenceScore: 63,
    riskScore: 38,
    positionSizeMultiplier: 0,
    relevantTimeframes: ["1M", "1W", "1D", "4H"],
    holdingRule: "Swing hold allowed only if 1M/1W/1D remain aligned.",
    entryRule: "Entry requires 1M/1W/1D macro alignment plus 4H confirmation.",
  },
  {
    symbol: "XAUUSD",
    style: "DAYTRADING",
    status: "WAIT",
    direction: "LONG",
    confidenceScore: 62,
    riskScore: 60,
    positionSizeMultiplier: 0,
    relevantTimeframes: ["1D", "4H", "2H", "1H", "15M"],
    holdingRule: "Intraday only. No swing hold unless higher timeframe confirms.",
    entryRule: "Entry requires 4H/2H/1H context plus 15M confirmation.",
  },
  {
    symbol: "XAUUSD",
    style: "SCALPING",
    status: "APPROVED",
    direction: "LONG",
    confidenceScore: 76,
    riskScore: 21,
    positionSizeMultiplier: 0.35,
    relevantTimeframes: ["1H", "15M", "5M", "1M_ENTRY"],
    holdingRule: "No overnight hold. Fast exit. Use only lower-timeframe confirmation.",
    entryRule: "Entry requires 15M setup plus 5M and 1M_ENTRY trigger.",
  },
  {
    symbol: "NAS100",
    style: "SWING",
    status: "APPROVED",
    direction: "LONG",
    confidenceScore: 71,
    riskScore: 32,
    positionSizeMultiplier: 0.8,
    relevantTimeframes: ["1M", "1W", "1D", "4H"],
    holdingRule: "Swing hold allowed only if 1M/1W/1D remain aligned.",
    entryRule: "Entry requires 1M/1W/1D macro alignment plus 4H confirmation.",
  },
  {
    symbol: "NAS100",
    style: "DAYTRADING",
    status: "WAIT",
    direction: "NEUTRAL",
    confidenceScore: 66,
    riskScore: 33,
    positionSizeMultiplier: 0,
    relevantTimeframes: ["1D", "4H", "2H", "1H", "15M"],
    holdingRule: "Intraday only. No swing hold unless higher timeframe confirms.",
    entryRule: "Entry requires 4H/2H/1H context plus 15M confirmation.",
  },
  {
    symbol: "NAS100",
    style: "SCALPING",
    status: "APPROVED",
    direction: "SHORT",
    confidenceScore: 72,
    riskScore: 25,
    positionSizeMultiplier: 0.35,
    relevantTimeframes: ["1H", "15M", "5M", "1M_ENTRY"],
    holdingRule: "No overnight hold. Fast exit. Use only lower-timeframe confirmation.",
    entryRule: "Entry requires 15M setup plus 5M and 1M_ENTRY trigger.",
  },
  {
    symbol: "SPX500",
    style: "SWING",
    status: "WAIT",
    direction: "NEUTRAL",
    confidenceScore: 51,
    riskScore: 43,
    positionSizeMultiplier: 0,
    relevantTimeframes: ["1M", "1W", "1D", "4H"],
    holdingRule: "Swing hold allowed only if 1M/1W/1D remain aligned.",
    entryRule: "Entry requires 1M/1W/1D macro alignment plus 4H confirmation.",
  },
  {
    symbol: "SPX500",
    style: "DAYTRADING",
    status: "WAIT",
    direction: "NEUTRAL",
    confidenceScore: 50,
    riskScore: 45,
    positionSizeMultiplier: 0,
    relevantTimeframes: ["1D", "4H", "2H", "1H", "15M"],
    holdingRule: "Intraday only. No swing hold unless higher timeframe confirms.",
    entryRule: "Entry requires 4H/2H/1H context plus 15M confirmation.",
  },
  {
    symbol: "SPX500",
    style: "SCALPING",
    status: "WAIT",
    direction: "NEUTRAL",
    confidenceScore: 51,
    riskScore: 45,
    positionSizeMultiplier: 0,
    relevantTimeframes: ["1H", "15M", "5M", "1M_ENTRY"],
    holdingRule: "No overnight hold. Fast exit. Use only lower-timeframe confirmation.",
    entryRule: "Entry requires 15M setup plus 5M and 1M_ENTRY trigger.",
  },
];

function groupBySymbol(inputs: MultiTimeframeStyleInput[]) {
  return inputs.reduce<Record<string, MultiTimeframeStyleInput[]>>((groups, input) => {
    if (!groups[input.symbol]) {
      groups[input.symbol] = [];
    }

    groups[input.symbol].push(input);
    return groups;
  }, {});
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function pickPreferredStyle(approvedStyles: MultiTimeframeStyleInput[]): TradingStyle | "NONE" {
  const priority: TradingStyle[] = ["SWING", "DAYTRADING", "SCALPING"];

  for (const style of priority) {
    if (approvedStyles.some((input) => input.style === style)) {
      return style;
    }
  }

  return "NONE";
}

function resolveFinalDirection(
  preferredStyle: TradingStyle | "NONE",
  approvedStyles: MultiTimeframeStyleInput[],
): Direction {
  if (preferredStyle === "NONE") return "NEUTRAL";

  return (
    approvedStyles.find((input) => input.style === preferredStyle)?.direction ?? "NEUTRAL"
  );
}

function createExecutionRule(
  preferredStyle: TradingStyle | "NONE",
  approvedStyles: MultiTimeframeStyleInput[],
): string {
  if (preferredStyle === "NONE") {
    return "No execution. Wait for at least one approved trading style.";
  }

  const preferred = approvedStyles.find((input) => input.style === preferredStyle);

  if (!preferred) {
    return "No execution. Preferred style is missing.";
  }

  if (preferredStyle === "SCALPING") {
    return `Scalping only. ${preferred.entryRule} ${preferred.holdingRule}`;
  }

  if (preferredStyle === "DAYTRADING") {
    return `Daytrading only. ${preferred.entryRule} ${preferred.holdingRule}`;
  }

  return `Swing trading allowed. ${preferred.entryRule} ${preferred.holdingRule}`;
}

function buildUnifiedStyleDecision(
  symbol: string,
  inputs: MultiTimeframeStyleInput[],
): UnifiedStyleDecision {
  const approvedStyles = inputs.filter((input) => input.status === "APPROVED");
  const blockedStyles = inputs.filter((input) => input.status === "BLOCKED");
  const waitingStyles = inputs.filter((input) => input.status === "WAIT");

  const preferredStyle = pickPreferredStyle(approvedStyles);
  const finalDirection = resolveFinalDirection(preferredStyle, approvedStyles);

  const tradeAllowed = approvedStyles.length > 0;
  const scalpOnlyMode =
    tradeAllowed &&
    approvedStyles.length === 1 &&
    approvedStyles[0].style === "SCALPING";

  const finalConfidenceScore = Math.round(
    average(approvedStyles.map((input) => input.confidenceScore)),
  );

  const finalRiskScore = Math.round(
    average(approvedStyles.map((input) => input.riskScore)),
  );

  const finalPositionSizeMultiplier =
    preferredStyle === "NONE"
      ? 0
      : approvedStyles.find((input) => input.style === preferredStyle)
          ?.positionSizeMultiplier ?? 0;

  const requiresStrictApproval =
    scalpOnlyMode ||
    finalRiskScore >= 45 ||
    blockedStyles.length > 0 ||
    preferredStyle === "SCALPING";

  const executionRule = createExecutionRule(preferredStyle, approvedStyles);

  const reason =
    preferredStyle === "NONE"
      ? `${symbol}: No approved trading style. Unified Decision should wait.`
      : scalpOnlyMode
        ? `${symbol}: Only scalping is approved. Unified Decision should allow scalp-only execution with reduced size and fast exit.`
        : `${symbol}: ${preferredStyle} is preferred. Other approved styles remain visible for Portfolio Brain context.`;

  return {
    id: `multi-timeframe-unified-${symbol.toLowerCase()}`,
    symbol,
    preferredStyle,
    allowedStyles: approvedStyles.map((input) => input.style),
    blockedStyles: blockedStyles.map((input) => input.style),
    waitingStyles: waitingStyles.map((input) => input.style),
    finalDirection,
    finalConfidenceScore,
    finalRiskScore,
    finalPositionSizeMultiplier,
    executionRule,
    tradeAllowed,
    requiresStrictApproval,
    scalpOnlyMode,
    reason,
  };
}

export function getMultiTimeframeUnifiedDecisionSyncReport(): MultiTimeframeUnifiedDecisionSyncReport {
  const groupedInputs = groupBySymbol(styleInputs);
  const decisions = Object.entries(groupedInputs).map(([symbol, inputs]) =>
    buildUnifiedStyleDecision(symbol, inputs),
  );

  const tradeAllowedSymbols = decisions.filter((decision) => decision.tradeAllowed).length;
  const scalpOnlySymbols = decisions.filter((decision) => decision.scalpOnlyMode).length;
  const swingAllowedSymbols = decisions.filter((decision) =>
    decision.allowedStyles.includes("SWING"),
  ).length;
  const daytradingAllowedSymbols = decisions.filter((decision) =>
    decision.allowedStyles.includes("DAYTRADING"),
  ).length;
  const blockedSymbols = decisions.filter((decision) => !decision.tradeAllowed).length;

  const recommendation =
    scalpOnlySymbols > 0
      ? "At least one symbol is scalp-only. Unified Decision should allow reduced-size scalping without enabling daytrading or swing exposure."
      : tradeAllowedSymbols > 0
        ? "Multi-timeframe styles are approved. Route preferred styles to Portfolio Brain and Trade Approval."
        : "No style is approved. Unified Decision should wait.";

  return {
    version: "V11.9.2",
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    tradeAllowedSymbols,
    scalpOnlySymbols,
    swingAllowedSymbols,
    daytradingAllowedSymbols,
    blockedSymbols,
    decisions,
    integrationTarget: [
      "Portfolio Brain Unified Decision",
      "Trade Approval Engine",
      "Execution Queue",
      "Position Sizing",
      "Strategy Weight Auto-Rebalancing",
    ],
    systemRule:
      "Multi-timeframe analysis produces separate decisions for scalping, daytrading and swing trading. Higher timeframe context informs risk but does not automatically block independently approved lower-timeframe styles.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
