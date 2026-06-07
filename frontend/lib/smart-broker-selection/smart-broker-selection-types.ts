export type BrokerId = "CAPITAL_COM" | "IC_MARKETS";

export type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

export type BrokerSelectionMode = "SIMULATION" | "READ_ONLY" | "PAPER_MODE";

export type BrokerSelectionStatus =
  | "READY"
  | "APPROVED"
  | "DEGRADED"
  | "BLOCKED";

export interface BrokerSelectionInput {
  brokerId: BrokerId;
  brokerName: string;
  preferredStyles: TradingStyle[];
  healthScore: number;
  riskScore: number;
  latencyMs: number;
  spreadScore: number;
  liquidityScore: number;
  executionQualityScore: number;
  leverageScore: number;
  isAvailable: boolean;
}

export interface BrokerSelectionScore {
  brokerId: BrokerId;
  brokerName: string;
  finalScore: number;
  status: BrokerSelectionStatus;
  allocationPercent: number;
  reasons: string[];
  metrics: {
    healthScore: number;
    riskScore: number;
    latencyMs: number;
    latencyScore: number;
    spreadScore: number;
    liquidityScore: number;
    executionQualityScore: number;
    leverageScore: number;
  };
}

export interface SmartBrokerSelectionReport {
  version: "V12.1.0";
  status: BrokerSelectionStatus;
  mode: BrokerSelectionMode[];
  selectedBroker: BrokerId | "MIXED" | "NONE";
  tradingStyleContext: TradingStyle;
  totalBrokersChecked: number;
  brokerScores: BrokerSelectionScore[];
  recommendedAllocation: Record<BrokerId, number>;
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
  };
  createdAt: string;
}