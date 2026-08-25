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

  /** Liegen überhaupt Preise im Cache? (26.08.)
   *
   * Hier stand `return true;` — bedingungslos. Die Mission-Control-Kachel
   * "Market Data" liest genau das und meldete deshalb IMMER "Online", auch
   * wenn der Cache leer war. Eine Gesundheitsprüfung, die nicht fehlschlagen
   * kann, prüft nichts.
   *
   * UND ER IST LEER: `priceCache.set()` wird nirgends im Programm aufgerufen —
   * nachgeprüft, nicht vermutet. Die Kachel behauptete also dauerhaft etwas,
   * das nicht stimmt.
   *
   * Jetzt meldet sie den echten Zustand. Steht dort WARNING, ist das kein
   * neuer Fehler, sondern zum ersten Mal die Wahrheit: diese Cache-Schicht
   * wird von niemandem gefüllt. Der Handelspfad benutzt sie nicht — er holt
   * seine Kurse direkt vom Broker und aus dem Python-Backend.
   */
  isReady() {
    return priceCache.getAll().length > 0;
  }

  /** Für die Anzeige: wie viele Preise liegen wirklich da? */
  cacheSize() {
    return priceCache.getAll().length;
  }
}

export const marketDataManager = new MarketDataManager();