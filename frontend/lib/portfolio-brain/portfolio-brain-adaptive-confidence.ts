import { buildPortfolioBrainStrategySyncReport } from "./portfolio-brain-strategy-sync";
import { buildPortfolioBrainOutcomeLearningSyncReport } from "./portfolio-brain-outcome-learning-sync";

export type PortfolioBrainAdaptiveConfidenceItem = {
  symbol: string;
  strategy: string;
  direction: string;
  baseConfidence: number;
  learningImpact: "BOOST" | "PENALTY" | "NEUTRAL" | "NONE";
  confidenceAdjustment: number;
  adaptiveConfidence: number;
  confidenceState: "AGGRESSIVE" | "NORMAL" | "CAUTIOUS" | "WAIT";
  approved: boolean;
  reason: string;
};

export type PortfolioBrainAdaptiveConfidenceReport = {
  version: string;
  status: "READY";
  totalItems: number;
  approvedItems: number;
  averageBaseConfidence: number;
  averageAdaptiveConfidence: number;
  totalAdjustment: number;
  bestAdaptiveItem: PortfolioBrainAdaptiveConfidenceItem | null;
  weakestAdaptiveItem: PortfolioBrainAdaptiveConfidenceItem | null;
  items: PortfolioBrainAdaptiveConfidenceItem[];
  recommendation: string;
  updatedAt: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getConfidenceState(input: {
  adaptiveConfidence: number;
  direction: string;
  approved: boolean;
}): "AGGRESSIVE" | "NORMAL" | "CAUTIOUS" | "WAIT" {
  if (!input.approved || input.direction === "WAIT") return "WAIT";
  if (input.adaptiveConfidence >= 75) return "AGGRESSIVE";
  if (input.adaptiveConfidence >= 60) return "NORMAL";
  return "CAUTIOUS";
}

export function buildPortfolioBrainAdaptiveConfidenceReport(): PortfolioBrainAdaptiveConfidenceReport {
  const strategySync = buildPortfolioBrainStrategySyncReport();
  const outcomeLearning = buildPortfolioBrainOutcomeLearningSyncReport();

  const items = strategySync.decisions.map((decision) => {
    const learningItem = outcomeLearning.items.find(
      (item) => item.symbol === decision.symbol
    );

    const confidenceAdjustment =
      learningItem?.confidenceAdjustment ?? 0;

    const learningImpact: "BOOST" | "PENALTY" | "NEUTRAL" | "NONE" =
      learningItem?.learningImpact ?? "NONE";

    const adaptiveConfidence = clamp(
      decision.confidence + confidenceAdjustment,
      0,
      100
    );

    const confidenceState = getConfidenceState({
      adaptiveConfidence,
      direction: decision.direction,
      approved: decision.approved,
    });

    return {
      symbol: decision.symbol,
      strategy: decision.strategy,
      direction: decision.direction,
      baseConfidence: decision.confidence,
      learningImpact,
      confidenceAdjustment,
      adaptiveConfidence,
      confidenceState,
      approved: decision.approved,
      reason: `${decision.symbol} adaptive confidence changed from ${decision.confidence}% to ${adaptiveConfidence}% using learning impact ${learningImpact}.`,
    };
  });

  const approvedItems = items.filter((item) => item.approved).length;

  const averageBaseConfidence =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce((sum, item) => sum + item.baseConfidence, 0) /
            items.length
        );

  const averageAdaptiveConfidence =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce((sum, item) => sum + item.adaptiveConfidence, 0) /
            items.length
        );

  const totalAdjustment = items.reduce(
    (sum, item) => sum + item.confidenceAdjustment,
    0
  );

  const tradableItems = items.filter((item) => item.confidenceState !== "WAIT");

  const bestAdaptiveItem =
    tradableItems.length === 0
      ? null
      : [...tradableItems].sort(
          (a, b) => b.adaptiveConfidence - a.adaptiveConfidence
        )[0];

  const weakestAdaptiveItem =
    tradableItems.length === 0
      ? null
      : [...tradableItems].sort(
          (a, b) => a.adaptiveConfidence - b.adaptiveConfidence
        )[0];

  const recommendation =
    bestAdaptiveItem === null
      ? "No adaptive confidence candidate available yet."
      : `${bestAdaptiveItem.symbol} is the strongest adaptive confidence candidate with ${bestAdaptiveItem.adaptiveConfidence}% confidence.`;

  return {
    version: "V11.5.8",
    status: "READY",
    totalItems: items.length,
    approvedItems,
    averageBaseConfidence,
    averageAdaptiveConfidence,
    totalAdjustment,
    bestAdaptiveItem,
    weakestAdaptiveItem,
    items,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
