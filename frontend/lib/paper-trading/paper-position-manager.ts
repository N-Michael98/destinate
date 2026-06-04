import {
  PaperOrder,
  PaperPosition,
} from "./paper-types";

function createPaperId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export class PaperPositionManager {
  openPosition(
    order: PaperOrder,
    size: number
  ): PaperPosition {
    return {
      id: createPaperId("paper-position"),

      orderId: order.id,

      symbol: order.symbol,
      direction: order.direction,

      entry: order.entry,
      currentPrice: order.entry,

      stopLoss: order.stopLoss,

      takeProfit1: order.takeProfit1,
      takeProfit2: order.takeProfit2,

      size,

      unrealizedPnL: 0,

      status: "OPEN",

      openedAt: new Date().toISOString(),
    };
  }

  updatePositionPrice(
    position: PaperPosition,
    currentPrice: number,
    unrealizedPnL: number
  ): PaperPosition {
    return {
      ...position,
      currentPrice,
      unrealizedPnL,
    };
  }

  closePosition(
    position: PaperPosition,
    closePrice: number,
    realizedPnL: number
  ): PaperPosition {
    return {
      ...position,
      currentPrice: closePrice,
      unrealizedPnL: realizedPnL,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
    };
  }
}