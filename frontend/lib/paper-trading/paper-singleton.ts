import { PaperTradingManager } from "./paper-trading-manager";

declare global {
  var paperTradingManager:
    | PaperTradingManager
    | undefined;
}

export const paperTradingManager =
  global.paperTradingManager ??
  new PaperTradingManager();

if (process.env.NODE_ENV !== "production") {
  global.paperTradingManager =
    paperTradingManager;
}