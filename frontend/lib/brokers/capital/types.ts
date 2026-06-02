import type {
  BrokerAccountSnapshot,
  BrokerOrderRequest,
  BrokerOrderResponse,
  BrokerPositionSnapshot,
} from "../shared/broker";

export type CapitalComCredentials = {
  apiKey: string;
  password: string;
  identifier: string;
};

export type CapitalComConnectorConfig = {
  mode: "SIMULATION" | "DEMO" | "LIVE";
  credentials?: CapitalComCredentials;
};

export type CapitalComAccountSnapshot = BrokerAccountSnapshot;
export type CapitalComPositionSnapshot = BrokerPositionSnapshot;
export type CapitalComOrderRequest = BrokerOrderRequest;
export type CapitalComOrderResponse = BrokerOrderResponse;