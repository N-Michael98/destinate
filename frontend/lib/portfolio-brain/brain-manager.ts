import { calculateBrainDecision } from "./brain-decision";
import { getBrainInputs } from "./brain-inputs";
import { validateBrainSafety } from "./brain-safety";
import type { PortfolioBrainReport } from "./brain-types";

export function runPortfolioBrain(): PortfolioBrainReport {
  const inputs = getBrainInputs();
  const decision = calculateBrainDecision(inputs);
  const safety = validateBrainSafety(decision);

  const recommendation = safety.safe
    ? `Portfolio Brain approves ${decision.finalDecision} in simulation mode with controlled risk.`
    : `Portfolio Brain blocks execution: ${
        safety.blockReason ?? decision.explanation
      }`;

  return {
    version: "V11.3.0",
    status: "READY",
    mode: "SIMULATION",
    inputs,
    decision,
    safety,
    recommendation,
    liveTradingEnabled: false,
    generatedAt: new Date().toISOString(),
  };
}

export function getBrainStatus() {
  return {
    version: "V11.3.0",
    status: "READY",
    mode: "SIMULATION",
    liveTradingEnabled: false,
  };
}