import type {
  Direction,
  StylePriorityDecision,
  StylePriorityInput,
  SymbolStylePriorityResult,
  TradingStyle,
  TradingStylePriorityEngineReport,
} from "./trading-style-priority-types";

const styleInputs: StylePriorityInput[] = [
  {
    symbol: "XAUUSD",
    style: "SCALPING",
    direction: "LONG",
    status: "STRICT_APPROVAL_REQUIRED",
    confidenceScore: 76,
    riskScore: 21,
    requestedPositionSize: 1000,
    finalPositionSize: 350,
    positionSizeMultiplier: 0.35,
    requiresStrictApproval: true,
  },
  {
    symbol: "XAUUSD",
    style: "DAYTRADING",
    direction: "LONG",
    status: "WAIT",
    confidenceScore: 62,
    riskScore: 60,
    requestedPositionSize: 1000,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
    requiresStrictApproval: false,
  },
  {
    symbol: "XAUUSD",
    style: "SWING",
    direction: "SHORT",
    status: "WAIT",
    confidenceScore: 63,
    riskScore: 38,
    requestedPositionSize: 1000,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
    requiresStrictApproval: false,
  },
  {
    symbol: "NAS100",
    style: "SWING",
    direction: "LONG",
    status: "APPROVED",
    confidenceScore: 72,
    riskScore: 29,
    requestedPositionSize: 1200,
    finalPositionSize: 960,
    positionSizeMultiplier: 0.8,
    requiresStrictApproval: false,
  },
  {
    symbol: "NAS100",
    style: "SCALPING",
    direction: "SHORT",
    status: "APPROVED",
    confidenceScore: 72,
    riskScore: 25,
    requestedPositionSize: 600,
    finalPositionSize: 480,
    positionSizeMultiplier: 0.8,
    requiresStrictApproval: false,
  },
  {
    symbol: "NAS100",
    style: "DAYTRADING",
    direction: "NEUTRAL",
    status: "WAIT",
    confidenceScore: 66,
    riskScore: 33,
    requestedPositionSize: 1000,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
    requiresStrictApproval: false,
  },
  {
    symbol: "SPX500",
    style: "SWING",
    direction: "NEUTRAL",
    status: "WAIT",
    confidenceScore: 51,
    riskScore: 43,
    requestedPositionSize: 900,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
    requiresStrictApproval: false,
  },
  {
    symbol: "SPX500",
    style: "DAYTRADING",
    direction: "LONG",
    status: "REJECTED",
    confidenceScore: 0,
    riskScore: 0,
    requestedPositionSize: 900,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
    requiresStrictApproval: false,
  },
  {
    symbol: "SPX500",
    style: "SCALPING",
    direction: "NEUTRAL",
    status: "WAIT",
    confidenceScore: 51,
    riskScore: 45,
    requestedPositionSize: 700,
    finalPositionSize: 0,
    positionSizeMultiplier: 0,
    requiresStrictApproval: false,
  },
];

function groupBySymbol(inputs: StylePriorityInput[]) {
  return inputs.reduce<Record<string, StylePriorityInput[]>>((groups, input) => {
    if (!groups[input.symbol]) {
      groups[input.symbol] = [];
    }

    groups[input.symbol].push(input);
    return groups;
  }, {});
}

function statusWeight(status: StylePriorityInput["status"]) {
  if (status === "APPROVED") return 35;
  if (status === "STRICT_APPROVAL_REQUIRED") return 25;
  if (status === "WAIT") return -10;
  return -40;
}

function styleWeight(style: TradingStyle) {
  if (style === "SWING") return 8;
  if (style === "DAYTRADING") return 5;
  return 3;
}

function calculatePriorityScore(input: StylePriorityInput) {
  const confidenceComponent = input.confidenceScore * 0.55;
  const riskComponent = (100 - input.riskScore) * 0.25;
  const statusComponent = statusWeight(input.status);
  const styleComponent = styleWeight(input.style);
  const sizeComponent = input.positionSizeMultiplier * 10;
  const strictPenalty = input.requiresStrictApproval ? -5 : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Number(
        (
          confidenceComponent +
          riskComponent +
          statusComponent +
          styleComponent +
          sizeComponent +
          strictPenalty
        ).toFixed(2),
      ),
    ),
  );
}

function getPriorityCandidates(inputs: StylePriorityInput[]) {
  return inputs
    .filter(
      (input) =>
        input.status === "APPROVED" ||
        input.status === "STRICT_APPROVAL_REQUIRED",
    )
    .sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a));
}

function resolveActiveDirection(primaryStyle: TradingStyle | "NONE", inputs: StylePriorityInput[]): Direction {
  if (primaryStyle === "NONE") return "NEUTRAL";

  return inputs.find((input) => input.style === primaryStyle)?.direction ?? "NEUTRAL";
}

function buildStyleDecision(
  input: StylePriorityInput,
  rank: number,
  primaryStyle: TradingStyle | "NONE",
  secondaryStyle: TradingStyle | "NONE",
): StylePriorityDecision {
  const priorityScore = calculatePriorityScore(input);
  const isBlocked = input.status === "REJECTED" || input.status === "WAIT";

  const reason =
    input.style === primaryStyle
      ? `${input.symbol}: ${input.style} selected as primary style with score ${priorityScore}.`
      : input.style === secondaryStyle
        ? `${input.symbol}: ${input.style} kept as secondary style with score ${priorityScore}.`
        : isBlocked
          ? `${input.symbol}: ${input.style} is not active because status is ${input.status}.`
          : `${input.symbol}: ${input.style} remains available but not prioritized.`;

  return {
    symbol: input.symbol,
    style: input.style,
    direction: input.direction,
    status: input.status,
    confidenceScore: input.confidenceScore,
    riskScore: input.riskScore,
    priorityScore,
    rank,
    isPrimary: input.style === primaryStyle,
    isSecondary: input.style === secondaryStyle,
    isBlocked,
    positionSizeMultiplier: input.positionSizeMultiplier,
    finalPositionSize: input.finalPositionSize,
    reason,
  };
}

function buildSymbolResult(
  symbol: string,
  inputs: StylePriorityInput[],
): SymbolStylePriorityResult {
  const candidates = getPriorityCandidates(inputs);
  const primaryStyle = candidates[0]?.style ?? "NONE";
  const secondaryStyle = candidates[1]?.style ?? "NONE";

  const activeDirection = resolveActiveDirection(primaryStyle, inputs);
  const primaryInput = inputs.find((input) => input.style === primaryStyle);

  const rankedInputs = [...inputs].sort(
    (a, b) => calculatePriorityScore(b) - calculatePriorityScore(a),
  );

  const decisions = rankedInputs.map((input, index) =>
    buildStyleDecision(input, index + 1, primaryStyle, secondaryStyle),
  );

  const blockedStyles = decisions
    .filter((decision) => decision.isBlocked)
    .map((decision) => decision.style);

  const waitingStyles = inputs
    .filter((input) => input.status === "WAIT")
    .map((input) => input.style);

  const rejectedStyles = inputs
    .filter((input) => input.status === "REJECTED")
    .map((input) => input.style);

  const tradeAllowed = primaryStyle !== "NONE";

  const recommendation =
    tradeAllowed
      ? `${symbol}: Primary trading style is ${primaryStyle}. Route only this active style into Execution Queue unless Portfolio Brain requests secondary confirmation.`
      : `${symbol}: No active primary style. Do not route trades to Execution Queue.`;

  return {
    id: `trading-style-priority-${symbol.toLowerCase()}`,
    symbol,
    primaryStyle,
    secondaryStyle,
    blockedStyles,
    waitingStyles,
    rejectedStyles,
    activeDirection,
    activePriorityScore: primaryInput ? calculatePriorityScore(primaryInput) : 0,
    activePositionSizeMultiplier: primaryInput?.positionSizeMultiplier ?? 0,
    activeFinalPositionSize: primaryInput?.finalPositionSize ?? 0,
    requiresStrictApproval: primaryInput?.requiresStrictApproval ?? false,
    tradeAllowed,
    decisions,
    recommendation,
  };
}

export function getTradingStylePriorityEngineReport(): TradingStylePriorityEngineReport {
  const groupedInputs = groupBySymbol(styleInputs);

  const results = Object.entries(groupedInputs).map(([symbol, inputs]) =>
    buildSymbolResult(symbol, inputs),
  );

  const symbolsWithPrimaryStyle = results.filter(
    (result) => result.primaryStyle !== "NONE",
  ).length;

  const scalpPrimarySymbols = results.filter(
    (result) => result.primaryStyle === "SCALPING",
  ).length;

  const daytradingPrimarySymbols = results.filter(
    (result) => result.primaryStyle === "DAYTRADING",
  ).length;

  const swingPrimarySymbols = results.filter(
    (result) => result.primaryStyle === "SWING",
  ).length;

  const blockedSymbols = results.filter((result) => !result.tradeAllowed).length;

  const recommendation =
    scalpPrimarySymbols > 0
      ? "At least one symbol is scalp-priority. Route scalp-priority trades with reduced position size and strict execution controls."
      : swingPrimarySymbols > 0 || daytradingPrimarySymbols > 0
        ? "Primary trading styles are available. Route only primary styles unless Portfolio Brain explicitly allows secondary styles."
        : "No primary trading style available. Keep execution blocked.";

  return {
    version: "V11.9.5",
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: results.length,
    symbolsWithPrimaryStyle,
    scalpPrimarySymbols,
    daytradingPrimarySymbols,
    swingPrimarySymbols,
    blockedSymbols,
    results,
    systemRule:
      "Trading Style Priority Engine selects one primary style per symbol. Secondary styles remain visible, but only the primary style should be routed to Execution Queue by default.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
