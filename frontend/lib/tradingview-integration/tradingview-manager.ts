import { DEFAULT_WIDGET_CONFIG } from "./widget-config";

export class TradingViewManager {
  getStatus() {
    return {
      provider: "TRADINGVIEW",
      status: "READY",
      mode: "WIDGET",
    };
  }

  getDefaultConfig() {
    return DEFAULT_WIDGET_CONFIG;
  }
}

export const tradingViewManager = new TradingViewManager();