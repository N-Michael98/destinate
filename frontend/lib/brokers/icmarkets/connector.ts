import type { BrokerConnector } from "../shared/broker";

export const icMarketsConnector: BrokerConnector = {
  name: "ic-markets",
  displayName: "IC Markets",
  status: "PREPARED",
  tradingPermission: "LOCKED",

  async connect() {
    return {
      success: false,
      broker: "ic-markets",
      orderId: null,
      message:
        "IC Markets connector is prepared, but MT5/cTrader bridge connection is locked until the demo bridge is implemented.",
    };
  },

  async getAccount() {
    return {
      broker: "ic-markets",
      accountId: null,
      currency: "CHF",
      balance: 30000,
      equity: 30000,
      marginUsed: 0,
      freeMargin: 30000,
      mode: "SIMULATION",
    };
  },

  async getPositions() {
    return [];
  },

  async placeOrder() {
    return {
      success: false,
      broker: "ic-markets",
      orderId: null,
      message:
        "Live and demo order placement are blocked in V7.3. IC Markets execution requires a later MT5/cTrader bridge.",
    };
  },
};