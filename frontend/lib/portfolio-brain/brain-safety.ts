import type { BrainResult } from "./brain-types";

export function validateBrainSafety(
  result: BrainResult
): boolean {
  if (!result.approved) {
    return false;
  }

  if (result.confidence < 75) {
    return false;
  }

  return true;
}