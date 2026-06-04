import {
  PaperDirection,
} from "./paper-types";

export class PaperPnLEngine {
  calculateUnrealizedPnL(
    direction: PaperDirection,
    entry: number,
    currentPrice: number,
    size: number
  ): number {
    const rawPnL =
      direction === "BUY"
        ? (currentPrice - entry) * size
        : (entry - currentPrice) * size;

    return Number(rawPnL.toFixed(2));
  }

  calculateRiskAmount(
    entry: number,
    stopLoss: number,
    size: number
  ): number {
    return Number(
      (Math.abs(entry - stopLoss) * size).toFixed(2)
    );
  }
}