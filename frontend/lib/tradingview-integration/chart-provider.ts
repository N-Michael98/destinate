export class ChartProvider {
  getWidgetUrl(symbol: string) {
    return `https://www.tradingview.com/chart/?symbol=${symbol}`;
  }
}

export const chartProvider = new ChartProvider();