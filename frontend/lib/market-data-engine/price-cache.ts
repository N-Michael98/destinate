import { MarketPrice } from "./market-types";

export class PriceCache {
  private prices = new Map<string, MarketPrice>();

  set(price: MarketPrice) {
    this.prices.set(price.symbol, price);
  }

  get(symbol: string) {
    return this.prices.get(symbol);
  }

  getAll() {
    return Array.from(this.prices.values());
  }

  // Alias für Kompatibilität mit market-regime route — gibt aktuelle Cache-Preise zurück
  refreshPrices() {
    return this.getAll();
  }
}

export const priceCache = new PriceCache();
