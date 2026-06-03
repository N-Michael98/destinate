import { icMarketsClient } from "./icmarkets-client";
import { icMarketsAccountSync } from "./account-sync";
import { icMarketsPositionSync } from "./position-sync";
import { icMarketsOrderFirewall } from "./order-firewall";
import { ICMarketsOrderRequest } from "./icmarkets-types";

export class ICMarketsManager {
  getStatus() {
    return {
      broker: "IC_MARKETS",
      status: icMarketsClient.getStatus(),
      config: icMarketsClient.getConfig(),
    };
  }

  async getAccountSnapshot() {
    return icMarketsAccountSync.getSnapshot();
  }

  async getAccountHealth() {
    return icMarketsAccountSync.getAccountHealth();
  }

  async getOpenPositions() {
    return icMarketsPositionSync.getOpenPositions();
  }

  async getExposureSummary() {
    return icMarketsPositionSync.getExposureSummary();
  }

  checkOrder(order: ICMarketsOrderRequest) {
    return icMarketsOrderFirewall.checkOrder(
      order,
      icMarketsClient.getConfig()
    );
  }
}

export const icMarketsManager =
  new ICMarketsManager();