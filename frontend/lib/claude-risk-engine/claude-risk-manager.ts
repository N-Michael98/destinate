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

      // ── `confidence: 85` ERSATZLOS ENTFALLEN (15.09.) ────────────────────
      //
      // Der Wert stand hier BEDINGUNGSLOS: jede Bewertung gab 85 zurueck,
      // egal bei welcher Eingabe. Die Risiko-Stufen darueber werden wirklich
      // abgeleitet — die Confidence nicht. Sie war eine Zahl, die sich als
      // Messung ausgab.
      //
      // Und sie war SICHTBAR: `/api/claude-risk/assess` wird vom Dashboard
      // gelesen (app/page.tsx), dort zu einem Durchschnitt verrechnet und als
      // „Confidence — Average score" angezeigt, mit Auto-Refresh alle 20
      // Sekunden. Ein konstanter Wert sah damit aus wie ein laufend neu
      // gemessener.
      //
      // Derselbe Weg wie bei `latencyMs` in `market-health.ts` (26.08.):
      // "hier wird keine Latenz gemessen, und eine ungemessene Zahl
      // auszugeben ist genau der Fehler". Es wird auch keine Ersatzformel
      // erfunden — eine hergeleitete Zahl waere nur eine besser getarnte
      // Behauptung. Das Feld ist weg, und die Anzeige zeigt jetzt, was es
      // wirklich gibt: die Risiko-Stufen und `approved`.
      //
      // NICHT im Handelspfad: `--impact` zeigt, dass dieser Manager nur ueber
      // seine eigene Route erreichbar ist. Der Handel entscheidet in
      // `ai-analysis-engine.ts` mit echten Modellantworten.
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