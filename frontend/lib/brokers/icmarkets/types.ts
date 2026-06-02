import type {
  BrokerAccountSnapshot,
  BrokerOrderRequest,
  BrokerOrderResponse,
  BrokerPositionSnapshot,
} from "../shared/broker";

export type ICMarketsPlatform = "MT5" | "cTrader";

export type ICMarketsCredentials = {
  accountId: string;
  server: string;
  platform: ICMarketsPlatform;
};

export type ICMarketsConnectorConfig = {
  mode: "SIMULATION" | "DEMO" | "LIVE";
  platform: ICMarketsPlatform;
  credentials?: ICMarketsCredentials;
};

export type ICMarketsAccountSnapshot = BrokerAccountSnapshot;
export type ICMarketsPositionSnapshot = BrokerPositionSnapshot;
export type ICMarketsOrderRequest = BrokerOrderRequest;
export type ICMarketsOrderResponse = BrokerOrderResponse;