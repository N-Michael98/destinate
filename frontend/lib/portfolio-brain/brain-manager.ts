import { calculateBrainDecision } from "./brain-decision";
import { getBrainInputs } from "./brain-inputs";
import { validateBrainSafety } from "./brain-safety";

export function runPortfolioBrain() {
  const inputs = getBrainInputs();

  const decision = calculateBrainDecision(inputs);

  const safe = validateBrainSafety(decision);

  return {
    inputs,
    decision,
    safe,
    liveTradingEnabled: false,
  };
}

export function getBrainStatus() {
  return {
    version: "V9.0",
    status: "READY",
    mode: "SIMULATION",
    liveTradingEnabled: false,
  };
}