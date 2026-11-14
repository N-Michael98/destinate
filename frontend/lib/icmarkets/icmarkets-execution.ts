/**
 * IC Markets cTrader order execution
 * Volume formula: MCP_units = riskAmount / (priceDistance × PRICE_VALUE[symbol])
 * Verified: XAUUSD 400 MCP × 0.01 × $50 stop = $200 risk ✓
 *           EURUSD 10M MCP × 0.01 × 0.002 stop = $200 risk ✓
 */

import { icPlaceOrder, isICMarketsConfigured, icGetPrice } from "./icmarkets-client";
import { getICMarketsSession } from "./icmarkets-session";
import { isKillswitchActive } from "../killswitch/killswitch-engine";
// EINE Lesart fuer den Kontostand — dieselbe Funktion, die beide
// Order-Routen benutzen. Eine zweite Fassung hier waere eine zweite
// Wahrheit, und genau diese Dopplung hat am 08.11. bei Capital und IC drei
// Erfindungen nebeneinander stehen lassen.
import { lesbarerKontostand, kontostandGrund } from "../kontostand/kontostand";

// cTrader symbol mapping: our internal symbol → exact cTrader symbolName
// Verified via /api/icmarkets/symbols endpoint (351 symbols)
const SYMBOL_MAP: Record<string, string> = {
  // Forex (all confirmed ✅)
  EURUSD: "EURUSD",   // symbolId: 1
  GBPUSD: "GBPUSD",   // symbolId: 2
  EURJPY: "EURJPY",   // symbolId: 3
  USDJPY: "USDJPY",   // symbolId: 4
  AUDUSD: "AUDUSD",   // symbolId: 5
  USDCHF: "USDCHF",   // symbolId: 6
  GBPJPY: "GBPJPY",   // symbolId: 7
  USDCAD: "USDCAD",   // symbolId: 8
  EURGBP: "EURGBP",   // symbolId: 9
  NZDUSD: "NZDUSD",   // symbolId: 12
  // Indices (all confirmed ✅)
  US500:  "US500",    // symbolId: 10013
  SPX500: "US500",
  UK100:  "UK100",    // symbolId: 10011
  US100:  "USTEC",    // symbolId: 10014
  NAS100: "USTEC",
  GER40:  "DE40",     // symbolId: 10046
  // Commodities (all confirmed ✅)
  XAUUSD: "XAUUSD",   // symbolId: 41
  GOLD:   "XAUUSD",
  XAGUSD: "XAGUSD",   // symbolId: 42
  SILVER: "XAGUSD",
  USOIL:  "WTI",      // symbolId: 10022
  OIL:    "WTI",
  BRENT:  "BRENT",    // symbolId: 10021
};

// cTrader is set to UNITS mode — volume parameter = actual units (1:1, no ×100 factor)
//
// PRICE_VALUE = $ per 1-price-unit move per 1 unit of instrument
// Formula: riskAmount = units × stopDistance × PRICE_VALUE
//
// USD-quoted (EURUSD, GBPUSD, XAUUSD, indices): PRICE_VALUE = 1.0
//   e.g. EURUSD: 100,000 units × 0.002 stop × 1.0 = $200 risk ✓
//   e.g. XAUUSD: 13 units × $15 stop × 1.0 = $195 risk ✓
// JPY-quoted: PRICE_VALUE = 1/rate (rate ≈ 145-155)
// USD-base/other-quote: PRICE_VALUE < 1 (CAD, CHF ≈ 0.73-0.91)
const PRICE_VALUE: Record<string, number> = {
  // USD-quoted forex (1 unit = 1 base currency ≈ $1, move in USD)
  EURUSD: 1.0, GBPUSD: 1.0, AUDUSD: 1.0, NZDUSD: 1.0,
  // USD-base / non-USD-quote
  USDCHF: 1.1,   // CHF quote → ÷0.90 ≈ 1.11
  USDCAD: 0.73,  // CAD quote → ÷1.37 ≈ 0.73
  EURGBP: 1.27,  // GBP quote → ×1.27
  // JPY-quoted (÷ ~150)
  USDJPY: 0.0067, EURJPY: 0.0067, GBPJPY: 0.0067,
  // Metals (1 unit = 1 oz/unit, price in USD)
  XAUUSD: 1.0, XAGUSD: 1.0,
  // Indices (1 unit = 1 contract = $1/point)
  USTEC: 1.0, US500: 1.0, UK100: 1.0, DE40: 1.0,
  // Oil: raw units ÷ 100 = display units (broker min=100 display=10000 raw)
  WTI: 0.01, BRENT: 0.01,
};

// Minimum units per instrument in Units mode (cTrader min)
const MIN_UNITS: Record<string, number> = {
  // Forex: min 0.01 lot = 1,000 units
  EURUSD: 1000, GBPUSD: 1000, USDJPY: 1000, AUDUSD: 1000,
  USDCAD: 1000, USDCHF: 1000, GBPJPY: 1000, EURJPY: 1000,
  EURGBP: 1000, NZDUSD: 1000,
  // Indices: min 1 contract
  USTEC: 1, US500: 1, UK100: 1, DE40: 1,
  // Commodities: metals min 1, oil min 10000 raw (= 100 display)
  XAUUSD: 1, XAGUSD: 1, WTI: 10000, BRENT: 10000,
};

// Default stop distance (price units) when no SL price available
const DEFAULT_STOP: Record<string, number> = {
  EURUSD: 0.002, GBPUSD: 0.002, AUDUSD: 0.002, NZDUSD: 0.002,
  USDCHF: 0.002, USDCAD: 0.002, EURGBP: 0.002,
  USDJPY: 0.30, EURJPY: 0.30, GBPJPY: 0.30,
  XAUUSD: 15, XAGUSD: 0.3,
  USTEC: 100, US500: 20, UK100: 30, DE40: 40,
  WTI: 1.0, BRENT: 1.0,
};

function calcICPositionSize(
  ctraderSymbol: string,
  accountBalance: number,
  riskPercent: number,
  stopDistance: number, // actual price distance (|entry - SL|)
): number | null {
  const riskAmount = accountBalance * (riskPercent / 100);
  const priceVal = PRICE_VALUE[ctraderSymbol] ?? 0.01;
  const stop = stopDistance > 0 ? stopDistance : (DEFAULT_STOP[ctraderSymbol] ?? 0.002);
  const rawUnits = riskAmount / (stop * priceVal);
  const step = MIN_UNITS[ctraderSymbol] ?? 1000;
  // Volume muss Vielfaches des volume step sein (cTrader Pflicht)
  const snapped = Math.floor(rawUnits / step) * step;
  const volume = Math.max(snapped, step);
  // ── EIN NICHT ENDLICHES VOLUMEN IST KEINE GROESSE (14.11.) ────────────
  //
  // Ausgerechnet, nicht angenommen: `Math.max` ist hier KEIN Schutz.
  // `Math.max(NaN, step)` ist NaN und `Math.max(Infinity, step)` ist
  // Infinity — die Klemme wirkt nur nach UNTEN. Capital rettet sich an
  // dieser Stelle ueber `Math.min(max, …)`; hier gibt es keine obere
  // Klemme, also ging ein NaN-Volumen ungeprueft an `icPlaceOrder`.
  //
  // Die Ursache kann auch NEBEN dem Kontostand liegen: `riskPercent` kommt
  // in der Route aus `body.riskPercent ?? 1.0`, und `??` faengt kein NaN.
  // Deshalb wird hier das ERGEBNIS geprueft und nicht jede Ursache
  // aufgezaehlt — ein Riegel, der am Ergebnis haengt, kann nicht veralten.
  //
  // `null` statt einer Ersatzgroesse: eine erfundene Groesse an einer
  // Stelle, die Geld bewegt, ist die Fehlerklasse vom 07.09.
  return Number.isFinite(volume) && volume > 0 ? volume : null;
}

export interface ICExecutionResult {
  ok: boolean;
  broker: "IC_MARKETS";
  positionId?: string;
  symbol: string;
  ctraderSymbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  stopDistance?: number;
  error?: string;
  executedAt: string;
}

export async function executeICMarketsOrder(req: {
  symbol: string;
  direction: "BUY" | "SELL";
  riskPercent: number;
  accountBalance: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  confidence: number;
  tradingStyle: string;
}): Promise<ICExecutionResult> {
  const ts = new Date().toISOString();

  // ── NOTAUS ZUERST (07.09.) — Begründung wie in capital-com-execution.ts ──
  //
  // Hier ist die mittelbare Deckung sogar SCHWÄCHER als auf der Capital-Seite:
  // der erste Riegel darunter ist `isICMarketsConfigured()`, und der prüft
  // Zugangsdaten aus der Umgebung, nicht die Sitzung — der Killswitch berührt
  // ihn also gar nicht. Erst der zweite (`!session`) greift mittelbar, und
  // auch der erst, nachdem `clearICMarketsSession()` im fire-and-forget-Zweig
  // von `disconnectBrokers()` durchgelaufen ist.
  //
  // Diese Datei ist ausserdem von KEINEM Prüfer abgesichert gewesen
  // (`system-map --impact` meldete "keiner"). Der neue Prüfteil in
  // `safety-nets` deckt jetzt beide Broker.
  if (isKillswitchActive()) {
    console.warn(`[icmarkets-execution] 🔴 Killswitch aktiv — Order ${req.symbol} ${req.direction} NICHT ausgeführt`);
    return { ok: false, broker: "IC_MARKETS", symbol: req.symbol, ctraderSymbol: "", direction: req.direction, volume: 0, error: "Killswitch aktiv — keine neuen Orders (/reset zum Entsperren)", executedAt: ts };
  }

  if (!isICMarketsConfigured()) {
    return { ok: false, broker: "IC_MARKETS", symbol: req.symbol, ctraderSymbol: "", direction: req.direction, volume: 0, error: "IC Markets not configured", executedAt: ts };
  }

  const session = getICMarketsSession();
  if (!session) {
    return { ok: false, broker: "IC_MARKETS", symbol: req.symbol, ctraderSymbol: "", direction: req.direction, volume: 0, error: "IC Markets not connected", executedAt: ts };
  }

  const ctraderSymbol = SYMBOL_MAP[req.symbol] ?? req.symbol;
  // ── EINE LESART FUER DEN KONTOSTAND, AUCH HIER (14.11.) ───────────────
  //
  // Vorher: `session.balance > 0 ? session.balance : req.accountBalance`.
  // Die VORRANGIGKEIT bleibt unveraendert (Sitzung zuerst, dann die
  // Anfrage) — gepruefft wird jetzt zusaetzlich, dass der Wert brauchbar
  // ist. `session.balance > 0` liess `Infinity` durch, und
  // `Math.max(Infinity, step)` in der Groessenrechnung ist wieder Infinity.
  //
  // Die Zusicherung gehoert hierher und nicht nur in die Route: diese
  // Funktion hat ZWEI Aufrufer (`/api/icmarkets/execute` und
  // `execution-agent.ts`, der `icSession?.balance ?? req.accountBalance`
  // weiterreicht) und muss FUER SICH stimmen — dieselbe Begruendung wie bei
  // `checkPriceAvailable` (24.08.).
  const balance = lesbarerKontostand(session.balance)
    ?? lesbarerKontostand(req.accountBalance);
  if (balance === null) {
    return {
      ok: false, broker: "IC_MARKETS", symbol: req.symbol, ctraderSymbol,
      direction: req.direction, volume: 0,
      error: `kein brauchbarer Kontostand (Sitzung: ${kontostandGrund(session.balance)}, `
        + `Anfrage: ${kontostandGrund(req.accountBalance)}) — ohne Kontostand keine `
        + `Positionsgroesse, KEINE Order platziert`,
      executedAt: ts,
    };
  }

  // ── Get live price to calculate actual stop distance ───────────────────────
  let stopDistance = DEFAULT_STOP[ctraderSymbol] ?? 0.002;
  try {
    const priceResult = await icGetPrice(ctraderSymbol);
    if (priceResult.ok && req.stopLossPrice && req.stopLossPrice > 0) {
      const currentPrice = req.direction === "BUY"
        ? (priceResult.ask ?? 0)
        : (priceResult.bid ?? 0);
      if (currentPrice > 0) {
        const actualStop = Math.abs(currentPrice - req.stopLossPrice);
        if (actualStop > 0) stopDistance = actualStop;
      }
    }
  } catch { /* use default */ }

  const volume = calcICPositionSize(ctraderSymbol, balance, req.riskPercent, stopDistance);
  // OHNE endliches Volumen KEINE Order (14.11.) — Begruendung in
  // `calcICPositionSize`. `String(...)` und nicht `JSON.stringify(...)`:
  // letzteres macht aus NaN und Infinity beides `null`, und dann nennt die
  // Meldung im interessanten Fall den Wert nicht.
  if (volume === null) {
    console.error(`[IC Markets] ⛔ ${ctraderSymbol}: Volumen nicht berechenbar `
      + `(balance=${String(balance)} risk=${String(req.riskPercent)} `
      + `stop=${String(stopDistance)}) — KEINE Order platziert.`);
    return {
      ok: false, broker: "IC_MARKETS", symbol: req.symbol, ctraderSymbol,
      direction: req.direction, volume: 0,
      error: `Volumen nicht berechenbar (balance=${String(balance)} `
        + `risk=${String(req.riskPercent)} stop=${String(stopDistance)}) `
        + `— KEINE Order platziert`,
      stopDistance,
      executedAt: ts,
    };
  }

  console.log(`[IC Markets] ${req.symbol}→${ctraderSymbol} ${req.direction} vol=${volume} balance=${balance} risk=${req.riskPercent}% stop=${stopDistance.toFixed(5)}`);

  const result = await icPlaceOrder(
    ctraderSymbol,
    req.direction,
    volume,
    req.stopLossPrice,
    req.takeProfitPrice,
  );

  if (!result.ok) {
    console.error(`[IC Markets] ❌ ${ctraderSymbol} failed: ${result.error}`);
  } else if (!result.positionId) {
    console.warn(`[IC Markets] ⚠️ ${ctraderSymbol} ${req.direction} — positionId empty`);
  } else {
    console.log(`[IC Markets] ✅ ${ctraderSymbol} ${req.direction} positionId=${result.positionId} vol=${volume}`);
  }

  return {
    ok: result.ok,
    broker: "IC_MARKETS",
    positionId: result.positionId,
    symbol: req.symbol,
    ctraderSymbol,
    direction: req.direction,
    volume,
    stopDistance,
    error: result.error,
    executedAt: ts,
  };
}
