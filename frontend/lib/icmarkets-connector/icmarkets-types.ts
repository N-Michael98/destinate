export type ICMarketsConnectionStatus = "DISCONNECTED" | "PREPARED" | "CONNECTED" | "ERROR";
export type ICMarketsAccountMode = "DEMO" | "LIVE";
export type ICMarketsOrderPermission = "READ_ONLY" | "PAPER_ONLY" | "DEMO_ALLOWED" | "LIVE_BLOCKED";
export type ICMarketsPositionSide = "LONG" | "SHORT";

export interface ICMarketsConfig {
  enabled: boolean;
  mode: ICMarketsAccountMode;
  server?: string;
  accountId?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  mcpToken?: string;  // cTrader Remote MCP Bearer token
  mcpUrl?: string;    // cTrader MCP server URL
  readOnly: boolean;
  allowLiveOrders: boolean;
  leverage?: number;  // 400, 500, or 1000
}

export interface ICMarketsAccountSnapshot {
  broker: "IC_MARKETS";
  mode: ICMarketsAccountMode;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  status: ICMarketsConnectionStatus;
  updatedAt: Date;
}

export interface ICMarketsPosition {
  id: string;
  symbol: string;
  side: ICMarketsPositionSide;
  volume: number;
  entryPrice: number;
  currentPrice: number;
  floatingPnL: number;
  openedAt: Date;
}

export interface ICMarketsOrderRequest {
  symbol: string;
  side: ICMarketsPositionSide;
  volume: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ICMarketsOrderFirewallResult {
  allowed: boolean;
  permission: ICMarketsOrderPermission;
  reasons: string[];
}
