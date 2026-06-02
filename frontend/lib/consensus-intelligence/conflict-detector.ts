import type {
  AiConsensusSignal,
  ConflictLevel,
} from "./consensus-types";

export function detectConflict(
  signals: AiConsensusSignal[]
): ConflictLevel {
  const directions = new Set(signals.map((signal) => signal.direction));

  if (directions.has("BLOCK")) return "HIGH";

  if (directions.size === 1) return "NONE";

  if (directions.has("LONG") && directions.has("SHORT")) {
    return "HIGH";
  }

  if (directions.has("WAIT")) {
    return "MEDIUM";
  }

  return "MINOR";
}