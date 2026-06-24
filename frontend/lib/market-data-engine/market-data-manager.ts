import { priceCache } from "./price-cache";
import { marketHealth } from "./market-health";

export class MarketDataManager {
  getHealth() {
    return marketHealth.getStatus();
  }

  getCachedPrices() {
    return priceCache.getAll();
  }

  getPrice(symbol: string) {
    return priceCache.get(symbol);
  }

  refreshPrices() {
    return priceCache.refreshPrices();
  }

  isReady() {
    return true;
  }
}

export const marketDataManager = new MarketDataManager();