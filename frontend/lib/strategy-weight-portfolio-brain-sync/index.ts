import type {
  StrategyWeightPortfolioBrainSyncDecision,
  StrategyWeightPortfolioBrainSyncReport,
} from "./strategy-weight-portfolio-brain-sync-types";

const strategyWeightInputs = [
  {
    id: "sync-spx500-trend-continuation",
    strategy: "Trend Continuation Strategy",
    symbol: "SPX500",
    currentWeight: 25,
    recommendedWeight: 15,
    weightChange: -10,
    status: "REDUCE",
  },
  {
    id: "sync-nas100-trend-continuation",
    strategy: "Trend Continuation Strategy",
    symbol: "NAS100",
    currentWeight: 25,
    recommendedWeight: 15,
    weightChange: -10,
    status: "REDUCE",
  },
  {
    id: "sync-xauusd-breakout",
    strategy: "Gold Breakout Strategy",
    symbol: "XAUUSD",
    currentWeight: 20,
    recommendedWeight: 10,
    weightChange: -10,
    status: "REDUCE",
  },
  {
    id: "sync-eurusd-mean-reversion",
    strategy: "EURUSD Mean Reversion Strategy",
    symbol: "EURUSD",
    currentWeight: 15,
    recommendedWeight: 5,
    weightChange: -10,
    status: "REDUCE",
  },
];

function mapPortfolioBrainImpact(weightChange: number) {
  if (weightChange > 0) return "INCREASE_EXPOSURE" as const;
  if (weightChange < 0) return "REDUCE_EXPOSURE" as const;
  return "HOLD_EXPOSURE" as const;
}

function mapTradeApprovalImpact(weightChange: number) {
  if (weightChange < 0) return "STRICTER_APPROVAL" as const;
  if (weightChange > 0) return "FLEXIBLE_APPROVAL" as const;
  return "NORMAL_APPROVAL" as const;
}

function mapPositionSizingImpact(weightChange: number) {
  if (weightChange < 0) return "REDUCE_SIZE" as const;
  if (weightChange > 0) return "ALLOW_SIZE_INCREASE" as const;
  return "NORMAL_SIZE" as const;
}

function createDecision(
  input: typeof strategyWeightInputs[number],
): StrategyWeightPortfolioBrainSyncDecision {
  const portfolioBrainImpact = mapPortfolioBrainImpact(input.weightChange);
  const tradeApprovalImpact = mapTradeApprovalImpact(input.weightChange);
  const positionSizingImpact = mapPositionSizingImpact(input.weightChange);

  const reason =
    input.weightChange < 0
      ? `${input.symbol} weight reduced from ${input.currentWeight} to ${input.recommendedWeight}. Portfolio Brain should reduce exposure and require stricter approval.`
      : input.weightChange > 0
        ? `${input.symbol} weight increased from ${input.currentWeight} to ${input.recommendedWeight}. Portfolio Brain may allow controlled exposure increase.`
        : `${input.symbol} weight unchanged. Portfolio Brain should keep exposure stable.`;

  return {
    ...input,
    portfolioBrainImpact,
    tradeApprovalImpact,
    positionSizingImpact,
    reason,
  };
}

export function getStrategyWeightPortfolioBrainSyncReport(): StrategyWeightPortfolioBrainSyncReport {
  const decisions = strategyWeightInputs.map(createDecision);

  const exposureIncreases = decisions.filter(
    (decision) => decision.portfolioBrainImpact === "INCREASE_EXPOSURE",
  ).length;

  const exposureReductions = decisions.filter(
    (decision) => decision.portfolioBrainImpact === "REDUCE_EXPOSURE",
  ).length;

  const exposureHolds = decisions.filter(
    (decision) => decision.portfolioBrainImpact === "HOLD_EXPOSURE",
  ).length;

  const strictApprovalItems = decisions.filter(
    (decision) => decision.tradeApprovalImpact === "STRICTER_APPROVAL",
  ).length;

  const normalApprovalItems = decisions.filter(
    (decision) => decision.tradeApprovalImpact === "NORMAL_APPROVAL",
  ).length;

  const flexibleApprovalItems = decisions.filter(
    (decision) => decision.tradeApprovalImpact === "FLEXIBLE_APPROVAL",
  ).length;

  const totalCurrentWeight = decisions.reduce(
    (sum, decision) => sum + decision.currentWeight,
    0,
  );

  const totalSyncedWeight = decisions.reduce(
    (sum, decision) => sum + decision.recommendedWeight,
    0,
  );

  const portfolioBrainMode =
    exposureReductions > exposureIncreases
      ? "DEFENSIVE"
      : exposureIncreases > exposureReductions
        ? "AGGRESSIVE"
        : "NORMAL";

  const recommendation =
    portfolioBrainMode === "DEFENSIVE"
      ? "Portfolio Brain should operate defensively. Reduce exposure, reduce position sizing and require stricter Trade Approval checks."
      : portfolioBrainMode === "AGGRESSIVE"
        ? "Portfolio Brain may allow controlled exposure increases, but only with Trade Approval confirmation."
        : "Portfolio Brain should keep normal exposure and continue monitoring learning signals.";

  return {
    version: "V11.8.2",
    status: "READY",
    mode: "SIMULATION",
    totalSyncItems: decisions.length,
    exposureIncreases,
    exposureReductions,
    exposureHolds,
    strictApprovalItems,
    normalApprovalItems,
    flexibleApprovalItems,
    totalCurrentWeight,
    totalSyncedWeight,
    portfolioBrainMode,
    decisions,
    aiCommunicationNote:
      "Future AI orchestration layer: GPT/OpenAI, Claude and specialized agents can analyze technical analysis, fundamental data, institutional intelligence, news, strategy learning and risk. Portfolio Brain remains the final decision layer.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
