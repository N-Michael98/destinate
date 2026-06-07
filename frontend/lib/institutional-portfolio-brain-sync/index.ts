import type {
  InstitutionalBias,
  InstitutionalPortfolioBrainSignal,
  InstitutionalPortfolioBrainSyncReport,
  PortfolioBrainInstitutionalAdjustment,
} from "./institutional-sync-types";

const institutionalSignals: InstitutionalPortfolioBrainSignal[] = [
  {
    id: "institutional-sync-fed-risk-check",
    sourceName: "Federal Reserve",
    sourceType: "CENTRAL_BANK",
    marketBias: "NEUTRAL",
    affectedMarkets: ["USD", "US500", "NAS100", "XAUUSD"],
    confidenceImpact: 2,
    riskImpact: 3,
    strategyImpact: 1,
    impactLevel: "CRITICAL",
    reason:
      "Federal Reserve source is critical for USD, US indices and gold. Use as macro confirmation before increasing exposure.",
  },
  {
    id: "institutional-sync-ecb-eur-check",
    sourceName: "European Central Bank",
    sourceType: "CENTRAL_BANK",
    marketBias: "NEUTRAL",
    affectedMarkets: ["EUR", "DAX", "EURUSD"],
    confidenceImpact: 1,
    riskImpact: 2,
    strategyImpact: 1,
    impactLevel: "CRITICAL",
    reason:
      "ECB source is critical for EUR and European indices. Use before EUR or DAX strategy confirmation.",
  },
  {
    id: "institutional-sync-bis-risk-context",
    sourceName: "Bank for International Settlements",
    sourceType: "GLOBAL_INSTITUTION",
    marketBias: "RISK_OFF",
    affectedMarkets: ["Global Equities", "Bonds", "FX"],
    confidenceImpact: -1,
    riskImpact: 4,
    strategyImpact: -1,
    impactLevel: "HIGH",
    reason:
      "BIS source can warn about financial stability and liquidity stress. Use as risk overlay for portfolio exposure.",
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function uniqueMarkets(signals: InstitutionalPortfolioBrainSignal[]) {
  return Array.from(
    new Set(signals.flatMap((signal) => signal.affectedMarkets)),
  );
}

function resolveInstitutionalBias(
  signals: InstitutionalPortfolioBrainSignal[],
): InstitutionalBias {
  const riskOnSignals = signals.filter(
    (signal) => signal.marketBias === "RISK_ON" || signal.marketBias === "BULLISH",
  ).length;

  const riskOffSignals = signals.filter(
    (signal) => signal.marketBias === "RISK_OFF" || signal.marketBias === "BEARISH",
  ).length;

  if (riskOnSignals > riskOffSignals) return "RISK_ON";
  if (riskOffSignals > riskOnSignals) return "RISK_OFF";
  if (riskOnSignals === 0 && riskOffSignals === 0) return "NEUTRAL";
  return "MIXED";
}

function buildPortfolioBrainAdjustment(
  signals: InstitutionalPortfolioBrainSignal[],
): PortfolioBrainInstitutionalAdjustment {
  const totalConfidenceImpact = signals.reduce(
    (sum, signal) => sum + signal.confidenceImpact,
    0,
  );

  const totalRiskImpact = signals.reduce(
    (sum, signal) => sum + signal.riskImpact,
    0,
  );

  const totalStrategyImpact = signals.reduce(
    (sum, signal) => sum + signal.strategyImpact,
    0,
  );

  const criticalSignals = signals.filter(
    (signal) => signal.impactLevel === "CRITICAL",
  ).length;

  const highSignals = signals.filter(
    (signal) => signal.impactLevel === "HIGH",
  ).length;

  const institutionalConfidenceScore = clamp(
    50 + totalConfidenceImpact * 6 + criticalSignals * 3,
  );

  const institutionalRiskScore = clamp(
    50 + totalRiskImpact * 4 + highSignals * 3 + criticalSignals * 4,
  );

  const institutionalStrategyScore = clamp(
    50 + totalStrategyImpact * 6 + totalConfidenceImpact * 2,
  );

  const institutionalBias = resolveInstitutionalBias(signals);

  const requireDefensiveMode =
    institutionalRiskScore >= 70 || institutionalBias === "RISK_OFF";

  const allowAggressiveTrading =
    institutionalConfidenceScore >= 70 &&
    institutionalRiskScore < 60 &&
    institutionalBias !== "RISK_OFF";

  const allowNormalTrading =
    institutionalRiskScore < 80 &&
    institutionalConfidenceScore >= 45;

  const reason =
    requireDefensiveMode
      ? "Institutional risk is elevated. Portfolio Brain should reduce aggression and require stronger confirmations."
      : allowAggressiveTrading
        ? "Institutional confidence is strong and risk is controlled. Portfolio Brain may allow controlled aggressive setups."
        : "Institutional conditions are acceptable for normal trading with confirmation filters.";

  return {
    institutionalConfidenceScore,
    institutionalRiskScore,
    institutionalStrategyScore,
    portfolioBrainConfidenceAdjustment: totalConfidenceImpact,
    portfolioBrainRiskAdjustment: totalRiskImpact,
    portfolioBrainStrategyAdjustment: totalStrategyImpact,
    allowAggressiveTrading,
    allowNormalTrading,
    requireDefensiveMode,
    institutionalBias,
    affectedMarkets: uniqueMarkets(signals),
    reason,
  };
}

export function getInstitutionalPortfolioBrainSyncReport(): InstitutionalPortfolioBrainSyncReport {
  const portfolioBrainAdjustment = buildPortfolioBrainAdjustment(institutionalSignals);

  const criticalSignals = institutionalSignals.filter(
    (signal) => signal.impactLevel === "CRITICAL",
  ).length;

  const highImpactSignals = institutionalSignals.filter(
    (signal) => signal.impactLevel === "HIGH",
  ).length;

  const recommendation = portfolioBrainAdjustment.requireDefensiveMode
    ? "Portfolio Brain should activate defensive mode, reduce exposure and require stronger Trade Approval confirmation."
    : portfolioBrainAdjustment.allowAggressiveTrading
      ? "Portfolio Brain may allow controlled aggressive trading because institutional confidence is strong and risk is acceptable."
      : "Portfolio Brain should continue normal trading with institutional confirmation filters.";

  return {
    version: "V11.7.5",
    status: "READY",
    mode: "SIMULATION",
    totalInstitutionalSignals: institutionalSignals.length,
    criticalSignals,
    highImpactSignals,
    institutionalSignals,
    portfolioBrainAdjustment,
    integrationTarget: [
      "Portfolio Brain",
      "Adaptive Confidence",
      "Portfolio Risk Management",
      "Trade Approval Engine",
      "Strategy Weight Auto-Rebalancing",
    ],
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
