export type BrokerName =
  | "IC_MARKETS"
  | "CAPITAL_COM";

export type BrokerConnectionStatus =
  | "ONLINE"
  | "DEGRADED"
  | "OFFLINE";

export type BrokerHealthStatus =
  | "HEALTHY"
  | "WARNING"
  | "CRITICAL";

export type BrokerHealthSnapshot = {
  broker: BrokerName;
  connectionStatus: BrokerConnectionStatus;
  apiHealth: BrokerHealthStatus;
  demoMode: true;
  readOnlyMode: true;
  liveExecutionEnabled: false;
  leverage: number;
  averageLatencyMs: number;
  currentSpreadPoints: number;
  maxAllowedSpreadPoints: number;
  executionQualityScore: number;
  liquidityScore: number;
  riskScore: number;
  brokerScore: number;
  canRouteOrders: boolean;
  shouldReduceSize: boolean;
  shouldBlockNewOrders: boolean;
  reason: string;
  updatedAt: string;
};

export type BrokerHealthMonitorReport = {
  version: "V12.0.7";
  status: "READY";
  mode: "SIMULATION";
  totalBrokers: number;
  healthyBrokers: number;
  warningBrokers: number;
  criticalBrokers: number;
  bestBroker: BrokerName | "NONE";
  worstBroker: BrokerName | "NONE";
  liveExecutionEnabled: false;
  readOnlyMode: true;
  brokers: BrokerHealthSnapshot[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
};
