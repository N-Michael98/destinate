// Capital.com DEMO Execution Bridge
// Translates GO signals from the execution queue into real DEMO orders
import {
  capitalPlaceOrder,
  capitalGetPositions,
  capitalClosePosition,
  EPIC_MAP,
  type OpenPosition,
  type OrderResult,
} from "./capital-com-client";
import { getCapitalSession } from "./capital-com-session";

export interface ExecutionRequest {
  symbol: string;
  direction: "BUY" | "SELL";
  riskPercent: number;
  accountBalance: number;
  stopLossPrice?: number;   // absolute price level from GPT analysis
  takeProfitPrice?: number; // absolute price level from GPT analysis
  stopLossPips?: number;
  takeProfitPips?: number;
  confidence: number;
  strategy: string;
  tradingStyle: "SCALPING" | "DAYTRADING" | "SWING";
}

export interface ExecutionResult {
  ok: boolean;
  broker: "CAPITAL_COM";
  mode: "DEMO";
  dealId?: string;
  dealReference?: string;
  symbol: string;
  direction: string;
  size: number;
  epic: string;
  error?: string;
  executedAt: string;
}

export interface CloseResult {
  ok: boolean;
  dealId: string;
  error?: string;
}

// Minimum deal sizes per epic on Capital.com DEMO
// Forex: size is in base currency UNITS (e.g. EUR for EURUSD), minimum = 100
const MIN_SIZE: Record<string, number> = {
  EURUSD: 100, GBPUSD: 100, USDJPY: 100, USDCHF: 100,
  AUDUSD: 100, USDCAD: 100, NZDUSD: 100, EURGBP: 100,
  EURJPY: 100, GBPJPY: 100,
  // Commodities
  GOLD: 0.1, SILVER: 0.1, OIL_CRUDE: 0.1, OIL_BRENT: 0.1, NATURAL_GAS: 0.1,
  // Indices
  US100: 0.1, US500: 0.1, US30: 0.1, GERMANY40: 0.1, UK100: 0.1, JAPAN225: 0.1,
  // Crypto
  BITCOIN: 0.001, ETHEREUM: 0.01, LITECOIN: 0.1, RIPPLE: 1,
  CARDANO: 1, SOLANA: 0.1, POLKADOT: 0.1, CHAINLINK: 0.1, BNB: 0.01,
};

// Pip value per 1 unit of base currency
// Forex: 1 pip = 0.0001 for most pairs, 0.01 for JPY pairs
// At size=1 EUR: pip value ≈ $0.0001. At size=100 EUR: $0.01 per pip
const PIP_VALUE_PER_UNIT: Record<string, number> = {
  EURUSD: 0.0001, GBPUSD: 0.0001, USDCHF: 0.0001,
  AUDUSD: 0.0001, USDCAD: 0.0001, NZDUSD: 0.0001, EURGBP: 0.0001,
  USDJPY: 0.000065, EURJPY: 0.000065, GBPJPY: 0.000065,
  // Commodities
  GOLD: 1, SILVER: 0.5, OIL_CRUDE: 1, OIL_BRENT: 1, NATURAL_GAS: 0.1,
  // Indices
  US100: 1, US500: 1, US30: 1, GERMANY40: 1, UK100: 1, JAPAN225: 1,
  // Crypto
  BITCOIN: 1, ETHEREUM: 1, LITECOIN: 1, RIPPLE: 0.01,
  CARDANO: 0.01, SOLANA: 1, POLKADOT: 1, CHAINLINK: 0.5, BNB: 1,
};

// Default stop loss in points by trading style per epic
const DEFAULT_STOP_BY_STYLE: Record<string, Record<string, number>> = {
  SCALPING: {
    EURUSD: 10, GBPUSD: 10, USDJPY: 10, USDCHF: 10, AUDUSD: 10,
    USDCAD: 10, NZDUSD: 10, EURGBP: 10, EURJPY: 15, GBPJPY: 15,
    GOLD: 5, SILVER: 0.20, OIL_CRUDE: 0.30, OIL_BRENT: 0.30, NATURAL_GAS: 0.10,
    US100: 20, US500: 15, US30: 50, GERMANY40: 20, UK100: 15, JAPAN225: 30,
    BITCOIN: 200, ETHEREUM: 20, LITECOIN: 2, RIPPLE: 0.02,
    CARDANO: 0.01, SOLANA: 2, POLKADOT: 0.5, CHAINLINK: 0.5, BNB: 5,
  },
  DAYTRADING: {
    EURUSD: 25, GBPUSD: 25, USDJPY: 25, USDCHF: 25, AUDUSD: 25,
    USDCAD: 25, NZDUSD: 25, EURGBP: 25, EURJPY: 35, GBPJPY: 35,
    GOLD: 15, SILVER: 0.50, OIL_CRUDE: 0.80, OIL_BRENT: 0.80, NATURAL_GAS: 0.25,
    US100: 50, US500: 35, US30: 120, GERMANY40: 50, UK100: 35, JAPAN225: 80,
    BITCOIN: 600, ETHEREUM: 60, LITECOIN: 5, RIPPLE: 0.05,
    CARDANO: 0.03, SOLANA: 5, POLKADOT: 1, CHAINLINK: 1, BNB: 15,
  },
  SWING: {
    EURUSD: 50, GBPUSD: 50, USDJPY: 50, USDCHF: 50, AUDUSD: 50,
    USDCAD: 50, NZDUSD: 50, EURGBP: 50, EURJPY: 70, GBPJPY: 70,
    GOLD: 30, SILVER: 1.00, OIL_CRUDE: 1.50, OIL_BRENT: 1.50, NATURAL_GAS: 0.50,
    US100: 100, US500: 70, US30: 250, GERMANY40: 100, UK100: 70, JAPAN225: 150,
    BITCOIN: 1500, ETHEREUM: 150, LITECOIN: 15, RIPPLE: 0.10,
    CARDANO: 0.05, SOLANA: 10, POLKADOT: 2, CHAINLINK: 2, BNB: 30,
  },
};

function calcPositionSize(
  epic: string,
  accountBalance: number,
  riskPercent: number,
  stopPoints: number,
  tradingStyle: string
): number {
  const riskAmount = accountBalance * (riskPercent / 100);
  const pipVal = PIP_VALUE_PER_UNIT[epic] ?? 1;
  const stop = stopPoints > 0 ? stopPoints : (DEFAULT_STOP_BY_STYLE[tradingStyle]?.[epic] ?? 20);
  const raw = riskAmount / (stop * pipVal);
  const min = MIN_SIZE[epic] ?? 0.1;
  const rounded = Math.max(min, Math.floor(raw * 10) / 10);
  return Number(rounded.toFixed(2));
}

export async function executeCapitalDemoOrder(
  req: ExecutionRequest
): Promise<ExecutionResult> {
  const session = getCapitalSession();
  if (!session) {
    return { ok: false, broker: "CAPITAL_COM", mode: "DEMO", symbol: req.symbol, direction: req.direction, size: 0, epic: "", error: "Capital.com not connected", executedAt: new Date().toISOString() };
  }

  const epic = EPIC_MAP[req.symbol];
  if (!epic) {
    return { ok: false, broker: "CAPITAL_COM", mode: "DEMO", symbol: req.symbol, direction: req.direction, size: 0, epic: "", error: `Unknown symbol: ${req.symbol}`, executedAt: new Date().toISOString() };
  }

  let size = calcPositionSize(
    epic,
    req.accountBalance,
    req.riskPercent,
    req.stopLossPips ?? 0,
    req.tradingStyle
  );

  // Retry with escalating size if Capital.com rejects minvalue
  let result: OrderResult = { ok: false, error: "" };
  for (let attempt = 0; attempt < 4; attempt++) {
    result = await capitalPlaceOrder(
      session.apiKey,
      session.cst,
      session.securityToken,
      {
        epic,
        direction: req.direction,
        size,
        stopLevel: req.stopLossPrice ?? undefined,
        profitLevel: req.takeProfitPrice ?? undefined,
        guaranteedStop: false,
      }
    );
    if (result.ok || !result.error?.includes("size.minvalue")) break;
    // Double size each attempt: 1 → 2 → 4 → 8 (or whatever multiplier needed)
    size = Math.round(size * 2 * 10) / 10;
    console.log(`[capital-com] size too small for ${epic}, retrying with size=${size}`);
  }

  return {
    ok: result.ok,
    broker: "CAPITAL_COM",
    mode: "DEMO",
    symbol: req.symbol,
    direction: req.direction,
    size,
    epic,
    dealId: result.dealId,
    dealReference: result.dealReference,
    error: result.error,
    executedAt: new Date().toISOString(),
  };
}

export async function getCapitalOpenPositions(): Promise<{ ok: boolean; positions: OpenPosition[]; error?: string }> {
  const session = getCapitalSession();
  if (!session) return { ok: false, positions: [], error: "Not connected" };

  const r = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
  return { ok: r.ok, positions: r.positions ?? [], error: r.error };
}

export async function closeCapitalPosition(dealId: string): Promise<CloseResult> {
  const session = getCapitalSession();
  if (!session) return { ok: false, dealId, error: "Not connected" };

  const result = await capitalClosePosition(session.apiKey, session.cst, session.securityToken, dealId);
  return { ok: result.ok, dealId, error: result.error };
}
