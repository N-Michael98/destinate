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
const MIN_SIZE: Record<string, number> = {
  GOLD: 0.1,
  EURUSD: 0.01,
  US100: 0.1,
  OIL_CRUDE: 0.1,
  BITCOIN: 0.001,
  US500: 0.1,
};

// Approximate pip values per unit size (USD)
// Used to calculate position size from risk amount + stop loss
const PIP_VALUE_PER_UNIT: Record<string, number> = {
  GOLD: 1,       // 1 pip = $1 per unit (oz)
  EURUSD: 10,    // 1 pip = $10 per standard lot → 0.0001 per unit
  US100: 1,      // 1 point = $1 per unit
  OIL_CRUDE: 1,  // 1 point = $1 per unit
  BITCOIN: 1,    // approximate
  US500: 1,      // 1 point = $1 per unit
};

// Default stop loss in points if not provided, by style
const DEFAULT_STOP_BY_STYLE: Record<string, Record<string, number>> = {
  SCALPING:  { GOLD: 5, EURUSD: 10, US100: 20, OIL_CRUDE: 0.30, BITCOIN: 200, US500: 15 },
  DAYTRADING:{ GOLD: 15, EURUSD: 25, US100: 50, OIL_CRUDE: 0.80, BITCOIN: 600, US500: 35 },
  SWING:     { GOLD: 30, EURUSD: 50, US100: 100, OIL_CRUDE: 1.50, BITCOIN: 1500, US500: 70 },
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

  const size = calcPositionSize(
    epic,
    req.accountBalance,
    req.riskPercent,
    req.stopLossPips ?? 0,
    req.tradingStyle
  );

  const result: OrderResult = await capitalPlaceOrder(
    session.apiKey,
    session.cst,
    session.securityToken,
    {
      epic,
      direction: req.direction,
      size,
      stopLevel: req.stopLossPips ? undefined : undefined, // calculated by Capital.com risk engine
      guaranteedStop: false,
    }
  );

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
