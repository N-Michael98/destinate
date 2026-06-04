import {
  PaperAccount,
  PaperDirection,
  PaperOrder,
  PaperPosition,
} from "./paper-types";

import { PaperAccountManager } from "./paper-account-manager";
import { PaperHistory } from "./paper-history";
import { PaperOrderManager } from "./paper-order-manager";
import { PaperPnLEngine } from "./paper-pnl-engine";
import { PaperPositionManager } from "./paper-position-manager";

export class PaperTradingManager {
  private orderManager =
    new PaperOrderManager();

  private positionManager =
    new PaperPositionManager();

  private pnlEngine =
    new PaperPnLEngine();

  private accountManager =
    new PaperAccountManager();

  private account:
    PaperAccount =
      this.accountManager.createDemoAccount();

  private orders:
    PaperOrder[] = [];

  private positions:
    PaperPosition[] = [];

  createAndFillPaperOrder(
    symbol: string,
    direction: PaperDirection,
    entry: number,
    stopLoss: number,
    takeProfit1: number,
    takeProfit2: number,
    confidence: number,
    reason: string,
    size = 1
  ) {
    const order =
      this.orderManager.createOrder(
        symbol,
        direction,
        entry,
        stopLoss,
        takeProfit1,
        takeProfit2,
        confidence,
        reason
      );

    PaperHistory.addOrderEvent(
      order,
      "ORDER_CREATED"
    );

    const filledOrder =
      this.orderManager.fillOrder(order);

    PaperHistory.addOrderEvent(
      filledOrder,
      "ORDER_FILLED"
    );

    const position =
      this.positionManager.openPosition(
        filledOrder,
        size
      );

    PaperHistory.addPositionEvent(
      position,
      "POSITION_OPENED"
    );

    this.orders.push(filledOrder);
    this.positions.push(position);

    this.account =
      this.accountManager.updateFromPositions(
        this.account,
        this.positions
      );

    return {
      order: filledOrder,
      position,
      account: this.account,
    };
  }

  updateMarketPrice(
    symbol: string,
    currentPrice: number
  ) {
    this.positions =
      this.positions.map((position) => {
        if (
          position.symbol !== symbol ||
          position.status !== "OPEN"
        ) {
          return position;
        }

        const unrealizedPnL =
          this.pnlEngine.calculateUnrealizedPnL(
            position.direction,
            position.entry,
            currentPrice,
            position.size
          );

        const updatedPosition =
          this.positionManager.updatePositionPrice(
            position,
            currentPrice,
            unrealizedPnL
          );

        PaperHistory.addPositionEvent(
          updatedPosition,
          "POSITION_UPDATED"
        );

        return updatedPosition;
      });

    this.account =
      this.accountManager.updateFromPositions(
        this.account,
        this.positions
      );

    return {
      positions: this.positions,
      account: this.account,
    };
  }

  getOrders() {
    return this.orders;
  }

  getPositions() {
    return this.positions;
  }

  getAccount() {
    return this.account;
  }

  getHistory() {
    return PaperHistory.getAll();
  }
}

export const paperTradingManager =
  new PaperTradingManager();