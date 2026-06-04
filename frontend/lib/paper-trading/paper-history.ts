import {
  PaperOrder,
  PaperPosition,
} from "./paper-types";

export type PaperHistoryRecord = {
  id: string;
  eventType:
    | "ORDER_CREATED"
    | "ORDER_FILLED"
    | "ORDER_REJECTED"
    | "POSITION_OPENED"
    | "POSITION_UPDATED"
    | "POSITION_CLOSED";

  symbol: string;
  message: string;
  createdAt: string;
};

function createHistoryId() {
  return `paper-history-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export class PaperHistory {
  private static records:
    PaperHistoryRecord[] = [];

  static addOrderEvent(
    order: PaperOrder,
    eventType:
      | "ORDER_CREATED"
      | "ORDER_FILLED"
      | "ORDER_REJECTED"
  ) {
    this.records.push({
      id: createHistoryId(),
      eventType,
      symbol: order.symbol,
      message: `${eventType}: ${order.symbol} ${order.direction}`,
      createdAt: new Date().toISOString(),
    });
  }

  static addPositionEvent(
    position: PaperPosition,
    eventType:
      | "POSITION_OPENED"
      | "POSITION_UPDATED"
      | "POSITION_CLOSED"
  ) {
    this.records.push({
      id: createHistoryId(),
      eventType,
      symbol: position.symbol,
      message: `${eventType}: ${position.symbol} ${position.direction}`,
      createdAt: new Date().toISOString(),
    });
  }

  static getAll() {
    return this.records;
  }

  static clear() {
    this.records = [];
  }
}