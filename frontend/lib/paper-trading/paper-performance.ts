import { PaperHistory } from "./paper-history";

type HistoryEvent = {
  id: string; type: string; entity: string; event: string;
  timestamp: string; payload: any;
};

export class PaperPerformance {
  static calculate(slot = "capital") {
    const history = PaperHistory.getAll(slot) as HistoryEvent[];

    const orderCreatedEvents = history.filter((i) => i.type === "ORDER_CREATED");
    const orderFilledEvents = history.filter((i) => i.type === "ORDER_FILLED");
    const positionOpenedEvents = history.filter((i) => i.type === "POSITION_OPENED");
    const positionUpdatedEvents = history.filter((i) => i.type === "POSITION_UPDATED");

    const unrealizedPnL = positionUpdatedEvents.reduce(
      (sum, i) => sum + Number(i.payload?.unrealizedPnL ?? 0), 0
    );
    const totalTrades = orderFilledEvents.length;
    const winningTrades = positionUpdatedEvents.filter((i) => Number(i.payload?.unrealizedPnL ?? 0) > 0).length;
    const losingTrades = positionUpdatedEvents.filter((i) => Number(i.payload?.unrealizedPnL ?? 0) < 0).length;
    const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(2)) : 0;

    return {
      version: "V10.2.7", totalEvents: history.length, totalTrades,
      orderCreated: orderCreatedEvents.length, orderFilled: orderFilledEvents.length,
      openPositions: positionOpenedEvents.length, positionUpdates: positionUpdatedEvents.length,
      winningTrades, losingTrades, winRate, realizedPnL: 0, unrealizedPnL,
      profitFactor: 0, averageRR: 0, bestTrade: null, worstTrade: null,
      status: "calculated", updatedAt: new Date().toISOString(),
    };
  }
}
