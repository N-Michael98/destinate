import { icMarketsClient } from "./icmarkets-client";
import { ICMarketsAccountSnapshot } from "./icmarkets-types";

export class ICMarketsAccountSync {
  async getSnapshot(): Promise<ICMarketsAccountSnapshot> {
    return icMarketsClient.getAccountSnapshot();
  }

  async getAccountHealth() {
    const snapshot = await this.getSnapshot();

    return {
      broker: snapshot.broker,
      mode: snapshot.mode,
      currency: snapshot.currency,
      balance: snapshot.balance,
      equity: snapshot.equity,
      freeMargin: snapshot.freeMargin,
      status: snapshot.status,
      healthy:
        snapshot.status === "PREPARED" ||
        snapshot.status === "CONNECTED",
      updatedAt: snapshot.updatedAt,
    };
  }
}

export const icMarketsAccountSync =
  new ICMarketsAccountSync();