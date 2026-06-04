import {
  PaperDirection,
  PaperOrder,
} from "./paper-types";

function createPaperId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export class PaperOrderManager {
  createOrder(
    symbol: string,
    direction: PaperDirection,
    entry: number,
    stopLoss: number,
    takeProfit1: number,
    takeProfit2: number,
    confidence: number,
    reason: string
  ): PaperOrder {
    return {
      id: createPaperId("paper-order"),

      symbol,
      direction,

      entry,
      stopLoss,

      takeProfit1,
      takeProfit2,

      confidence,

      status: "PENDING",

      reason,

      createdAt: new Date().toISOString(),
    };
  }

  fillOrder(order: PaperOrder): PaperOrder {
    return {
      ...order,
      status: "FILLED",
    };
  }

  rejectOrder(order: PaperOrder): PaperOrder {
    return {
      ...order,
      status: "REJECTED",
    };
  }
}