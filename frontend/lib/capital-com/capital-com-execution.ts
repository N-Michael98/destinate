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
  currentPrice?: number;    // bid (SELL) or ask (BUY) — used for accurate position sizing
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
  openLevel?: number; // real fill price from Capital.com confirm
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
  US100: 0.1, US500: 0.1, US30: 0.1, GERMANY40: 0.1, UK100: 0.1, J225: 0.1,
  // Crypto — Epics am 03.08. korrigiert (siehe EPIC_MAP), Werte unverändert
  BTCUSD: 0.001, ETHUSD: 0.01, LTCUSD: 0.1, XRPUSD: 1,
  ADAUSD: 1, SOLUSD: 0.1, DOTUSD: 0.1, LINKUSD: 0.1, BNBUSD: 0.01,
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
  US100: 1, US500: 1, US30: 1, GERMANY40: 1, UK100: 1, J225: 1,
  // Crypto — Epics am 03.08. korrigiert (siehe EPIC_MAP), Werte unverändert
  BTCUSD: 1, ETHUSD: 1, LTCUSD: 1, XRPUSD: 0.01,
  ADAUSD: 0.01, SOLUSD: 1, DOTUSD: 1, LINKUSD: 0.5, BNBUSD: 1,
};

// Default stop loss in points by trading style per epic
const DEFAULT_STOP_BY_STYLE: Record<string, Record<string, number>> = {
  SCALPING: {
    EURUSD: 10, GBPUSD: 10, USDJPY: 10, USDCHF: 10, AUDUSD: 10,
    USDCAD: 10, NZDUSD: 10, EURGBP: 10, EURJPY: 15, GBPJPY: 15,
    GOLD: 5, SILVER: 0.20, OIL_CRUDE: 0.30, OIL_BRENT: 0.30, NATURAL_GAS: 0.10,
    US100: 20, US500: 15, US30: 50, GERMANY40: 20, UK100: 15, J225: 30,
    BTCUSD: 200, ETHUSD: 20, LTCUSD: 2, XRPUSD: 0.02,
    ADAUSD: 0.01, SOLUSD: 2, DOTUSD: 0.5, LINKUSD: 0.5, BNBUSD: 5,
  },
  DAYTRADING: {
    EURUSD: 25, GBPUSD: 25, USDJPY: 25, USDCHF: 25, AUDUSD: 25,
    USDCAD: 25, NZDUSD: 25, EURGBP: 25, EURJPY: 35, GBPJPY: 35,
    GOLD: 15, SILVER: 0.50, OIL_CRUDE: 0.80, OIL_BRENT: 0.80, NATURAL_GAS: 0.25,
    US100: 50, US500: 35, US30: 120, GERMANY40: 50, UK100: 35, J225: 80,
    BTCUSD: 600, ETHUSD: 60, LTCUSD: 5, XRPUSD: 0.05,
    ADAUSD: 0.03, SOLUSD: 5, DOTUSD: 1, LINKUSD: 1, BNBUSD: 15,
  },
  SWING: {
    EURUSD: 50, GBPUSD: 50, USDJPY: 50, USDCHF: 50, AUDUSD: 50,
    USDCAD: 50, NZDUSD: 50, EURGBP: 50, EURJPY: 70, GBPJPY: 70,
    GOLD: 30, SILVER: 1.00, OIL_CRUDE: 1.50, OIL_BRENT: 1.50, NATURAL_GAS: 0.50,
    US100: 100, US500: 70, US30: 250, GERMANY40: 100, UK100: 70, J225: 150,
    BTCUSD: 1500, ETHUSD: 150, LTCUSD: 15, XRPUSD: 0.10,
    ADAUSD: 0.05, SOLUSD: 10, DOTUSD: 2, LINKUSD: 2, BNBUSD: 30,
  },
};

// Pip size per instrument: 1 pip = this many price units
// Used to convert |currentPrice - stopLossPrice| → pips for position sizing
const PIP_SIZE: Record<string, number> = {
  EURUSD: 0.0001, GBPUSD: 0.0001, USDCHF: 0.0001,
  AUDUSD: 0.0001, USDCAD: 0.0001, NZDUSD: 0.0001, EURGBP: 0.0001,
  USDJPY: 0.01, EURJPY: 0.01, GBPJPY: 0.01,
  // All others (commodities, indices, crypto): 1.0 (price unit = 1 point)
};

// Maximum sizes to stay within Capital.com DEMO margin limits
// Forex raised to 5000 so risk-based sizing isn't capped below 1% for typical accounts
const MAX_SIZE: Record<string, number> = {
  EURUSD: 5000, GBPUSD: 5000, USDJPY: 5000, USDCHF: 5000,
  AUDUSD: 5000, USDCAD: 5000, NZDUSD: 5000, EURGBP: 5000,
  EURJPY: 5000, GBPJPY: 5000,
  GOLD: 5, SILVER: 50, OIL_CRUDE: 10, OIL_BRENT: 10, NATURAL_GAS: 100,
  US100: 5, US500: 5, US30: 2, GERMANY40: 5, UK100: 5, J225: 2,
  BTCUSD: 0.05, ETHUSD: 0.5, LTCUSD: 10, XRPUSD: 500,
  ADAUSD: 500, SOLUSD: 5, DOTUSD: 10, LINKUSD: 10, BNBUSD: 0.5,
};

// ── Selbstprüfung beim Start (03.08.) ────────────────────────────────────────
// Anlass: neun Krypto-Epics und der Nikkei waren jahrelang falsch benannt.
// Capital antwortete mit HTTP 404, die Märkte fielen still in den yfinance-
// Rückfall, und niemand konnte es sehen. Beim Korrigieren wurde ausserdem klar,
// wie leicht die nächste Lücke entsteht: das Epic ist Schlüssel in SECHS
// Grössen- und Stop-Tabellen. Wird eine davon vergessen, greift bei genau
// diesem Markt die MAX_SIZE-Klemme nicht mehr — die Position könnte um ein
// Vielfaches zu gross werden, ohne dass irgendetwas fehlschlägt.
//
// Deshalb prüft das Modul sich beim Laden selbst. Die Prüfung ändert nichts
// und bricht nichts ab; sie macht eine Lücke nur unübersehbar, statt sie bis
// zur ersten falsch dimensionierten Order zu verstecken.
function assertEpicTablesComplete(): void {
  const tables: Record<string, Record<string, number>> = {
    MIN_SIZE,
    PIP_VALUE_PER_UNIT,
    MAX_SIZE,
    "DEFAULT_STOP.SCALPING":   DEFAULT_STOP_BY_STYLE.SCALPING,
    "DEFAULT_STOP.DAYTRADING": DEFAULT_STOP_BY_STYLE.DAYTRADING,
    "DEFAULT_STOP.SWING":      DEFAULT_STOP_BY_STYLE.SWING,
  };
  const luecken: string[] = [];
  for (const [symbol, epic] of Object.entries(EPIC_MAP)) {
    for (const [name, table] of Object.entries(tables)) {
      if (table[epic] == null) luecken.push(`${symbol}(${epic}) fehlt in ${name}`);
    }
  }
  if (luecken.length > 0) {
    console.error(
      `[capital-exec] ⚠️ LÜCKE in den Epic-Tabellen — betroffene Märkte werden ohne ` +
      `Grössen-/Stop-Vorgabe gehandelt: ${luecken.join(" | ")}`
    );
  }
}
assertEpicTablesComplete();

function calcPositionSize(
  epic: string,
  accountBalance: number,
  riskPercent: number,
  stopPoints: number,
  tradingStyle: string,
  stopLossPrice?: number,
  currentPrice?: number,
): number {
  const riskAmount = accountBalance * (riskPercent / 100);
  const pipVal = PIP_VALUE_PER_UNIT[epic] ?? 1;

  let effectiveStop = stopPoints > 0 ? stopPoints : 0;

  // Priority: compute stop from actual GPT price levels (most accurate)
  if (effectiveStop <= 0 && stopLossPrice && stopLossPrice > 0 && currentPrice && currentPrice > 0) {
    const pipSize = PIP_SIZE[epic] ?? 1.0;
    const distance = Math.abs(currentPrice - stopLossPrice);
    if (distance > 0) effectiveStop = distance / pipSize;
  }

  // Fallback to style-based default when no price data available
  if (effectiveStop <= 0) {
    effectiveStop = DEFAULT_STOP_BY_STYLE[tradingStyle]?.[epic] ?? 20;
  }

  const raw = riskAmount / (effectiveStop * pipVal);
  const min = MIN_SIZE[epic] ?? 0.1;
  const max = MAX_SIZE[epic] ?? raw;
  const rounded = Math.min(max, Math.max(min, Math.floor(raw * 10) / 10));
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
    req.tradingStyle,
    req.stopLossPrice,
    req.currentPrice,
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
    // Verdoppeln, aber NIE über MAX_SIZE hinaus (Generalkontroll-Fund 28.07.):
    // die Klemme aus calcPositionSize wurde hier vorher umgangen — bei 4
    // Versuchen bis zu 8x der risikobasiert berechneten Grösse.
    const doubled = Math.round(size * 2 * 10) / 10;
    const maxAllowed = MAX_SIZE[epic];
    const next = maxAllowed != null ? Math.min(doubled, maxAllowed) : doubled;
    if (next <= size) {
      console.warn(`[capital-com] ${epic}: Broker-Mindestgrösse liegt über MAX_SIZE (${maxAllowed}) — Order NICHT ausgeführt statt Risiko zu überschreiten`);
      break;
    }
    size = next;
    console.log(`[capital-com] size too small for ${epic}, retrying with size=${size} (max=${maxAllowed ?? "n/a"})`);
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
    openLevel: result.openLevel,
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
