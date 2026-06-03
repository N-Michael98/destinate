export type TradingViewSymbol = {
  symbol: string;
  description: string;
  exchange: string;
  type: string;
};

export type TradingViewWidgetConfig = {
  symbol: string;
  interval: string;
  theme: "dark" | "light";
  autosize: boolean;
};

export type TradingViewStatus = {
  provider: "TRADINGVIEW";
  status: "READY" | "PREPARED";
  mode: "WIDGET";
};