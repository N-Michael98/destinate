import { PaperTradingManager } from "./paper-trading-manager";

export type BrokerSlot = "capital" | "broker2";

declare global {
  var __paper_capital__: PaperTradingManager | undefined;
  var __paper_broker2__: PaperTradingManager | undefined;
}

export const paperManagerCapital =
  global.__paper_capital__ ?? new PaperTradingManager("capital");

export const paperManagerBroker2 =
  global.__paper_broker2__ ?? new PaperTradingManager("broker2");

if (process.env.NODE_ENV !== "production") {
  global.__paper_capital__ = paperManagerCapital;
  global.__paper_broker2__ = paperManagerBroker2;
}

export function getPaperManager(broker?: string | null): PaperTradingManager {
  return broker === "broker2" ? paperManagerBroker2 : paperManagerCapital;
}

// backward compat
export const paperTradingManager = paperManagerCapital;
