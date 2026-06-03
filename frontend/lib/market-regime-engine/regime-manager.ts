import { classifyRegime } from "./regime-classifier";

export class RegimeManager {
  getRegime(symbol: string, price: number, spread: number) {
    const result = classifyRegime(symbol, price, spread);

    return {
      symbol,
      confidence: 0.85,
      updatedAt: new Date().toISOString(),
      ...result,
    };
  }
}

export const regimeManager = new RegimeManager();