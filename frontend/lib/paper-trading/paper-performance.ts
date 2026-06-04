import { PaperHistory } from "./paper-history";

type HistoryEvent = {
  id: string;
  type: string;
  entity: string;
  event: string;
  timestamp: string;
  payload: any;
};

export class PaperPerformance {
  static calculate() {
    const history = PaperHistory.getAll() as HistoryEvent[];

    const orderCreatedEvents = history.filter(
      (item) => item.type === "ORDER_CREATED"
    );

    const orderFilledEvents = history.filter(
      (item) => item.type === "ORDER_FILLED"
    );

    const positionOpenedEvents = history.filter(
      (item) => item.type === "POSITION_OPENED"
    );

    const positionUpdatedEvents = history.filter(
      (item) => item.type === "POSITION_UPDATED"
    );

    const realizedPnL = 0;

    const unrealizedPnL = positionUpdatedEvents.reduce((sum, item) => {
      const value = Number(item.payload?.unrealizedPnL ?? 0);
      return sum + value;
    }, 0);

    const totalTrades = orderFilledEvents.length;
    const openPositions = positionOpenedEvents.length;

    const winningTrades = positionUpdatedEvents.filter(
      (item) => Number(item.payload?.unrealizedPnL ?? 0) > 0
    ).length;

    const losingTrades = positionUpdatedEvents.filter(
      (item) => Number(item.payload?.unrealizedPnL ?? 0) < 0
    ).length;

    const winRate =
      totalTrades > 0
        ? Number(((winningTrades / totalTrades) * 100).toFixed(2))
        : 0;

    return {
      version: "V10.2.7",
      totalEvents: history.length,
      totalTrades,
      orderCreated: orderCreatedEvents.length,
      orderFilled: orderFilledEvents.length,
      openPositions,
      positionUpdates: positionUpdatedEvents.length,
      winningTrades,
      losingTrades,
      winRate,
      realizedPnL,
      unrealizedPnL,
      profitFactor: 0,
      averageRR: 0,
      bestTrade: null,
      worstTrade: null,
      status: "calculated",
      updatedAt: new Date().toISOString(),
    };
  }
}