import type { BrokerConnector, BrokerOrderRequest, BrokerOrderResponse } from "../shared/broker";
import { getCapitalSession, isCapitalConnected } from "../../capital-com/capital-com-session";
import { capitalGetAccounts, capitalPlaceOrder, capitalGetPositions, EPIC_MAP } from "../../capital-com/capital-com-client";

export const capitalComConnector: BrokerConnector = {
  name: "capital-com",
  displayName: "Capital.com",
  get status() {
    return isCapitalConnected() ? ("CONNECTED" as const) : ("PREPARED" as const);
  },
  get tradingPermission() {
    return isCapitalConnected() ? ("DEMO_ONLY" as const) : ("LOCKED" as const);
  },

  async connect() {
    return {
      success: isCapitalConnected(),
      broker: "capital-com" as const,
      orderId: null,
      message: isCapitalConnected()
        ? "Capital.com DEMO session active."
        : "Not connected — use Settings → Broker Connections to connect.",
    };
  },

  async getAccount() {
    const session = getCapitalSession();
    if (!session) {
      return { broker: "capital-com" as const, accountId: null, currency: "USD", balance: 0, equity: 0, marginUsed: 0, freeMargin: 0, mode: "SIMULATION" as const };
    }
    const result = await capitalGetAccounts(session.apiKey, session.cst, session.securityToken);
    const acc = result.accounts?.[0];
    return {
      broker: "capital-com" as const,
      accountId: acc?.accountId ?? session.accountId,
      currency: acc?.currency ?? "USD",
      balance: acc?.balance ?? 0,
      equity: acc?.balance ?? 0,
      marginUsed: 0,
      freeMargin: acc?.available ?? 0,
      mode: "DEMO" as const,
    };
  },

  async getPositions() {
    const session = getCapitalSession();
    if (!session) return [];
    const result = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
    return (result.positions ?? []).map((p) => ({
      id: p.dealId,
      broker: "capital-com" as const,
      market: p.symbol,
      direction: p.direction,
      size: p.size,
      entryPrice: p.openLevel,
      stopLoss: p.stopLevel,
      takeProfit: p.profitLevel,
      profitLoss: p.profitLoss,
      status: "OPEN" as const,
    }));
  },

  async placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResponse> {
    const session = getCapitalSession();
    if (!session) {
      return { success: false, broker: "capital-com" as const, orderId: null, message: "Capital.com not connected" };
    }

    const epic = EPIC_MAP[order.market];
    if (!epic) {
      return { success: false, broker: "capital-com" as const, orderId: null, message: `Unknown market: ${order.market}` };
    }

    const result = await capitalPlaceOrder(session.apiKey, session.cst, session.securityToken, {
      epic,
      direction: order.direction,
      size: order.size,
      stopLevel: order.stopLoss,
      guaranteedStop: false,
    });

    return {
      success: result.ok,
      broker: "capital-com" as const,
      orderId: result.dealId ?? null,
      message: result.ok ? `DEMO order placed: ${result.dealId}` : (result.error ?? "Order failed"),
    };
  },
};
