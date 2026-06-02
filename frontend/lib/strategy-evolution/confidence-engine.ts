export function calculateConfidence(
  winRate: number,
  averageReturn: number
) {
  return Math.min(
    100,
    Math.round(
      winRate * 0.7 +
      averageReturn * 10
    )
  );
}