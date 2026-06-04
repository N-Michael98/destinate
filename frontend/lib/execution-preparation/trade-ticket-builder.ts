import { ExecutionTicket } from "./execution-types";

export class TradeTicketBuilder {
  static build(
    symbol: string,
    direction: "BUY" | "SELL",
    entry: number,
    stopLoss: number,
    takeProfit1: number,
    takeProfit2: number,
    confidence: number,
    approved: boolean,
    reason: string
  ): ExecutionTicket {

    return {
      symbol,
      direction,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      confidence,
      approved,
      reason,
      createdAt:
        new Date().toISOString()
    };
  }
}