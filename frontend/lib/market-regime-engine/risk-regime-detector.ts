import type { RiskRegime } from "./regime-types";

export function detectRiskRegime(params: {
  symbol: string;
  trendScore: number;
  volatilityScore: number;
}): {
  risk: RiskRegime;
  riskScore: number;
} {
  if (params.symbol === "BTCUSD") {
    return {
      risk:
        params.trendScore >= 55 && params.volatilityScore < 70
          ? "RISK_ON"
          : "SPECULATIVE",
      riskScore: params.volatilityScore >= 70 ? 72 : 58,
    };
  }

  if (params.symbol === "XAUUSD") {
    return {
      risk:
        params.trendScore <= 45 || params.volatilityScore >= 60
          ? "SAFE_HAVEN"
          : "RISK_OFF",
      riskScore: params.volatilityScore >= 60 ? 76 : 62,
    };
  }

  if (["NAS100", "SPX500"].includes(params.symbol)) {
    return {
      risk: params.trendScore >= 55 ? "RISK_ON" : "RISK_OFF",
      riskScore: params.trendScore >= 55 ? 64 : 70,
    };
  }

  return {
    risk: "NEUTRAL",
    riskScore: 50,
  };
}
