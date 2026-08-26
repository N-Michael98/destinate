// PYTHON_YFINANCE ergänzt (26.08.): der Handelszyklus holt Kurse in zwei
// Stufen — erst beim Broker, dann als Rückfall aus dem Python-Backend. Ohne
// eigenen Namen für die zweite Stufe müsste ein yfinance-Kurs als
// "CAPITAL_COM" ausgegeben werden, und der Herkunft sähe man nicht mehr an,
// wie sie zustande kam.
export type FeedSource =
  | "TRADINGVIEW"
  | "CAPITAL_COM"
  | "IC_MARKETS"
  | "PYTHON_YFINANCE";

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  previousBid?: number;
  previousAsk?: number;
  /** Zeitstempel der QUELLE (Broker/Backend). Leer = die Quelle hat keinen
   *  geliefert — darf NICHT als "jetzt" gewertet werden (Fund 02.08.). */
  timestamp: string;
  /** Wann dieser Eintrag im Cache abgelegt wurde. Immer gesetzt, immer
   *  unsere eigene Uhr — daran und nur daran hängt das Verfallsdatum. */
  receivedAt: string;
  source: FeedSource;
}

export interface MarketFeedStatus {
  source: FeedSource;
  /** Liegen von dieser Quelle FRISCHE Kurse im Cache? Abgeleitet, nicht
   *  behauptet — siehe market-health.ts. */
  connected: boolean;
  /** Anzahl frischer Kurse dieser Quelle. */
  prices: number;
  /** Alter des jüngsten Kurses dieser Quelle in Minuten. null = keiner da.
   *
   *  Ersetzt das frühere `latencyMs` (26.08.). Dieses Programm misst keine
   *  Feed-Latenz; die 20 ms für TradingView waren eine erfundene Zahl über
   *  eine Verbindung, die es gar nicht gibt. Das Alter ist messbar. */
  ageMinutes: number | null;
  updatedAt: string;
  /** Klartext für die Anzeige — warum steht diese Quelle so da? */
  note: string;
}
