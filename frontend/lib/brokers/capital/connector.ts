import type { BrokerConnector } from "../shared/broker";

export const capitalComConnector: BrokerConnector = {
  name: "capital-com",
  displayName: "Capital.com",
  status: "PREPARED",
  tradingPermission: "LOCKED",

  async connect() {
    return {
      success: false,
      broker: "capital-com",
      orderId: null,
      message:
        "Capital.com connector is prepared, but real API connection is locked until credentials are added through environment variables.",
    };
  },

  async getAccount() {
    return {
      broker: "capital-com",
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
      broker: "capital-com",
      orderId: null,
      message:
        "Live and demo order placement are blocked in V7.3. This connector only prepares the Broker API Layer.",
    };
  },
};