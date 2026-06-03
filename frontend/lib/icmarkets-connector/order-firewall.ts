import {
  ICMarketsConfig,
  ICMarketsOrderFirewallResult,
  ICMarketsOrderRequest,
} from "./icmarkets-types";

export class ICMarketsOrderFirewall {
  checkOrder(
    order: ICMarketsOrderRequest,
    config: ICMarketsConfig
  ): ICMarketsOrderFirewallResult {
    const reasons: string[] = [];

    if (!config.enabled) {
      reasons.push("IC Markets connector is disabled.");
    }

    if (config.readOnly) {
      reasons.push("Connector is in read-only mode.");
    }

    if (!config.allowLiveOrders) {
      reasons.push("Live orders are blocked by safety firewall.");
    }

    if (!order.symbol) {
      reasons.push("Order symbol is missing.");
    }

    if (order.volume <= 0) {
      reasons.push("Order volume must be greater than zero.");
    }

    return {
      allowed: reasons.length === 0,
      permission: config.allowLiveOrders
        ? "DEMO_ALLOWED"
        : "LIVE_BLOCKED",
      reasons,
    };
  }
}

export const icMarketsOrderFirewall =
  new ICMarketsOrderFirewall();