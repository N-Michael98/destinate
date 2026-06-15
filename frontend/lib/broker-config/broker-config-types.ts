export type BrokerKey = "CAPITAL_COM" | "IC_MARKETS";
export type SymbolKey = "XAUUSD" | "EURUSD" | "NAS100" | "USOIL" | "BTCUSD" | "SPX500";
export type BotMode = "MANUAL" | "AUTO";
export type AccountMode = "DEMO" | "LIVE";

export interface BrokerSpreadLeverage {
  symbol: SymbolKey;
  symbolLabel: string;
  leverage: number;
  leverageLabel: string;
  spreadTypical: number;
  spreadUnit: string;
  commissionPerLot: number;
  marginPercent: number;
  notes: string;
}

export interface BrokerProfile {
  key: BrokerKey;
  name: string;
  shortName: string;
  regulation: string;
  accountMode: AccountMode;
  accountType: string;
  baseCurrency: string;
  commission: string;
  symbols: BrokerSpreadLeverage[];
  color: string;
}

export interface BrokerConnection {
  brokerKey: BrokerKey;
  connected: boolean;
  accountId: string | null;
  accountMode: AccountMode;
  lastConnectedAt: string | null;
  error: string | null;
}

export interface BotSettings {
  mode: BotMode;
  maxTradesPerDay: number;
  maxConcurrentPositions: number;
  autoApproveThreshold: number;
  pauseOnLoss: boolean;
  pauseOnLossPercent: number;
  maxTradesPerDayByStyle: {
    DAYTRADING: number;
    SCALPING: number;
    SWING: number;
  };
}

export interface RiskSettings {
  maxRiskPerTradePct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  maxExposurePct: number;
  minConfidenceScore: number;
}

export interface SystemSettings {
  version: string;
  botSettings: BotSettings;
  riskSettings: RiskSettings;
  connections: BrokerConnection[];
  updatedAt: string;
}
