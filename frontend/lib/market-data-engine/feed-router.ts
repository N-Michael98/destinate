export class FeedRouter {
  getPreferredFeed() {
    return [
      "CAPITAL_COM",
      "IC_MARKETS",
      "TRADINGVIEW",
    ];
  }
}

export const feedRouter = new FeedRouter();