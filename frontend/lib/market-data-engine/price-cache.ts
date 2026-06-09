import { MarketPrice } from "./market-types";

export class PriceCache {
  private prices = new Map<string, MarketPrice>();

  constructor() {
    this.seedMockPrices();
  }

  private seedMockPrices() {
    const now = new Date().toISOString();

    const mockPrices: MarketPrice[] = [
      {
        symbol: "XAUUSD",
        bid: 3372.15,
        ask: 3372.45,
        spread: 0.3,
        timestamp: now,
        source: "TRADINGVIEW",
      },
      {
        symbol: "USOIL",
        bid: 78.42,
        ask: 78.47,
        spread: 0.05,
        timestamp: now,
        source: "TRADINGVIEW",
      },
      {
        symbol: "EURUSD",
        bid: 1.0842,
        ask: 1.0844,
        spread: 0.0002,
        timestamp: now,
        source: "TRADINGVIEW",
      },
      {
        symbol: "BTCUSD",
        bid: 68250,
        ask: 68280,
        spread: 30,
        timestamp: now,
        source: "TRADINGVIEW",
      },
    ];

    mockPrices.forEach((price) => this.set(price));
  }

  set(price: MarketPrice) {
    this.prices.set(price.symbol, price);
  }

  get(symbol: string) {
    return this.prices.get(symbol);
  }

  getAll() {
    return Array.from(this.prices.values());
  }

  refreshMockPrices() {
    const now = new Date().toISOString();

    const updated = this.getAll().map((price) => {
      const midpoint = (price.bid + price.ask) / 2;
      const movementPower =
        price.symbol === "BTCUSD"
          ? price.spread * 2.8
          : price.symbol === "XAUUSD"
            ? price.spread * 7
            : price.symbol === "USOIL"
              ? price.spread * 8
              : price.spread * 12;

      const movement = (Math.random() - 0.5) * movementPower;
      const bid = Number((price.bid + movement).toFixed(5));
      const ask = Number((bid + price.spread).toFixed(5));

      return {
        ...price,
        previousBid: price.bid,
        previousAsk: price.ask,
        bid,
        ask,
        timestamp: now,
      };
    });

    updated.forEach((price) => this.set(price));

    return updated;
  }
}

export const priceCache = new PriceCache();
