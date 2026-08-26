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

  /** Liegen überhaupt frische Preise im Cache? (26.08.)
   *
   * Hier stand `return true;` — bedingungslos. Die Mission-Control-Kachel
   * "Market Data" liest genau das und meldete deshalb IMMER "Online", auch
   * wenn der Cache leer war. Eine Gesundheitsprüfung, die nicht fehlschlagen
   * kann, prüft nichts.
   *
   * `getAll()` verwirft abgelaufene Einträge, deshalb heisst `true` hier
   * "es liegen Kurse da UND sie sind nicht älter als CACHE_MAX_ALTER_MS" —
   * nicht bloss "irgendwann lag mal etwas da".
   */
  isReady() {
    return priceCache.getAll().length > 0;
  }

  /** Für die Anzeige: wie viele frische Preise liegen wirklich da? */
  cacheSize() {
    return priceCache.getAll().length;
  }

  /** Für die Anzeige: wie alt ist der jüngste Eintrag (Minuten)?
   *  null = Cache leer. Unterscheidet "wird gefüllt" von "steht still". */
  cacheAlterMinuten() {
    return priceCache.alterMinuten();
  }
}

export const marketDataManager = new MarketDataManager();