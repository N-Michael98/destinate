import {
  RiskAssessment,
  RiskLevel
} from "./risk-types";

import { detectDrawdownRisk } from "./drawdown-checker";
import { detectExposureRisk } from "./exposure-checker";
import { detectPositionRisk } from "./position-size-checker";
import { detectVolatilityRisk } from "./volatility-risk-checker";
import { buildRiskReasoning } from "./risk-reasoning-builder";

export class ClaudeRiskManager {

  assess(
    symbol: string,
    drawdown: number,
    exposure: number,
    riskPercent: number,
    volatility: string
  ): RiskAssessment {

    const drawdownRisk =
      detectDrawdownRisk(drawdown);

    const exposureRisk =
      detectExposureRisk(exposure);

    const positionRisk =
      detectPositionRisk(riskPercent);

    const volatilityRisk =
      detectVolatilityRisk(volatility);

    const approved =
      drawdownRisk !== "EXTREME" &&
      exposureRisk !== "EXTREME" &&
      positionRisk !== "EXTREME";

    const overallRisk: RiskLevel =
      approved ? "MEDIUM" : "HIGH";

    return {
      symbol,

      drawdownRisk,
      exposureRisk,
      positionRisk,
      volatilityRisk,

      overallRisk,

      approved,

      confidence: 85,

      reasoning: buildRiskReasoning(
        drawdownRisk,
        exposureRisk,
        positionRisk,
        volatilityRisk
      ),

      createdAt: new Date().toISOString()
    };
  }
}