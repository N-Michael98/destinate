export function detectVolatility(spread: number): string {
  if (spread > 10) {
    return "VOLATILE";
  }

  return "NORMAL";
}