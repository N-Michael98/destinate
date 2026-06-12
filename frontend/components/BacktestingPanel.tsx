"use client";

import { useState } from "react";

type Trade = {
  entry_time: string;
  exit_time: string;
  direction: "LONG" | "SHORT";
  entry_price: number;
  exit_price: number;
  stop_loss?: number;
  take_profit?: number;
  result: "WIN" | "LOSS";
  pnl_usd: number;
  balance: number;
  indicators?: Record<string, string | number | null>;
};

type BacktestResult = {
  symbol: string;
  interval: string;
  period: string;
  strategy: string;
  strategy_name: string;
  indicators_used: string[];
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
  initial_balance: number;
  final_balance: number;
  total_pnl: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  trades: Trade[];
  error?: string;
};

type CompareResult = {
  symbol: string;
  interval: string;
  period: string;
  results: BacktestResult[];
  best: BacktestResult | null;
};

const SYMBOLS = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "NAS100", "OIL", "USDCHF", "USDJPY"];
const INTERVALS = ["1h", "4h", "1d"];
const PERIODS = ["1mo", "3mo", "6mo", "1y"];

const STRATEGIES = [
  { value: "rsi",   label: "RSI Mean Reversion",     desc: "RSI(14) Oversold/Overbought",          color: "text-purple-400" },
  { value: "macd",  label: "MACD Crossover",          desc: "MACD(12,26,9) Histogram Crossover",    color: "text-blue-400" },
  { value: "ema",   label: "EMA Crossover",           desc: "EMA(20) kreuzt EMA(50)",               color: "text-cyan-400" },
  { value: "bb",    label: "Bollinger Band Reversion",desc: "Price trifft BB-Bänder (20, 2σ)",      color: "text-orange-400" },
  { value: "multi", label: "Multi-Signal Consensus",  desc: "2 von 3: RSI + MACD + EMA stimmen",   color: "text-green-400" },
];

const SYMBOL_META: Record<string, string> = {
  EURUSD: "EUR/USD", GBPUSD: "GBP/USD", XAUUSD: "Gold",
  BTCUSD: "Bitcoin", NAS100: "NASDAQ 100", OIL: "Crude Oil",
  USDCHF: "USD/CHF", USDJPY: "USD/JPY",
};

function StatCard({ label, value, sub, color = "text-white" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-700/40">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function EquityCurve({ trades, initial }: { trades: Trade[]; initial: number }) {
  if (!trades || trades.length === 0) return null;
  const points = [initial, ...trades.map((t) => t.balance)];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const W = 500; const H = 120; const PAD = 10;
  const coords = points.map((b, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
    const y = PAD + ((max - b) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const isProfit = points[points.length - 1] >= initial;
  const lineColor = isProfit ? "#22c55e" : "#ef4444";
  const fillColor = isProfit ? "#22c55e22" : "#ef444422";
  const fillPath = `M ${coords[0]} L ${coords.join(" L ")} L ${W - PAD},${H - PAD} L ${PAD},${H - PAD} Z`;
  const linePath = `M ${coords.join(" L ")}`;
  const baselineY = PAD + ((max - initial) / range) * (H - PAD * 2);
  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 p-3">
      <div className="text-xs text-slate-400 mb-2">Equity Curve — {points.length - 1} Trades</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        <path d={fillPath} fill={fillColor} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" />
        <line x1={PAD} y1={baselineY} x2={W - PAD} y2={baselineY}
          stroke="#64748b" strokeWidth="0.5" strokeDasharray="3,3" />
      </svg>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>${min.toFixed(0)}</span><span>${max.toFixed(0)}</span>
      </div>
    </div>
  );
}

function CompareTable({ data }: { data: CompareResult }) {
  const sorted = [...(data.results ?? [])].filter(r => !r.error).sort((a, b) => (b.profit_factor ?? 0) - (a.profit_factor ?? 0));
  if (sorted.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-700/40 overflow-hidden">
      <div className="bg-slate-800/60 px-3 py-2 text-xs text-slate-400 font-medium flex items-center gap-2">
        Strategie-Vergleich — {data.symbol} {data.interval} {data.period}
        {data.best && <span className="ml-auto text-green-300">🏆 Beste: {data.best.strategy_name}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/40">
              {["Strategie", "Indikatoren", "Trades", "Win%", "PF", "Return", "MaxDD", "Sharpe"].map(h => (
                <th key={h} className="text-left text-slate-400 px-3 py-1.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isBest = r.strategy === data.best?.strategy;
              return (
                <tr key={r.strategy} className={`border-b border-slate-800/60 ${isBest ? "bg-green-500/5" : "hover:bg-slate-800/30"}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {isBest && <span>🏆</span>}
                      <span className={`font-medium ${STRATEGIES.find(s => s.value === r.strategy)?.color ?? "text-white"}`}>
                        {r.strategy_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{(r.indicators_used ?? []).join(", ")}</td>
                  <td className="px-3 py-2 text-slate-300">{r.total_trades ?? 0}</td>
                  <td className={`px-3 py-2 font-medium ${(r.win_rate ?? 0) >= 50 ? "text-green-400" : "text-red-400"}`}>
                    {r.win_rate ?? 0}%
                  </td>
                  <td className={`px-3 py-2 font-medium ${(r.profit_factor ?? 0) >= 1.2 ? "text-green-400" : (r.profit_factor ?? 0) >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                    {(r.profit_factor ?? 0).toFixed(2)}
                  </td>
                  <td className={`px-3 py-2 font-medium ${(r.total_return_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(r.total_return_pct ?? 0) > 0 ? "+" : ""}{r.total_return_pct ?? 0}%
                  </td>
                  <td className={`px-3 py-2 ${(r.max_drawdown_pct ?? 0) < 10 ? "text-green-400" : (r.max_drawdown_pct ?? 0) < 20 ? "text-yellow-400" : "text-red-400"}`}>
                    -{r.max_drawdown_pct ?? 0}%
                  </td>
                  <td className="px-3 py-2 text-slate-300">{r.sharpe_ratio ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-900/40 px-3 py-2 text-xs text-slate-500">
        Diese Ergebnisse fliessen in Strategy Evolution + Forward Testing ein — beste Strategie pro Symbol wird priorisiert.
      </div>
    </div>
  );
}

function SingleResult({ result }: { result: BacktestResult }) {
  return (
    <div className="space-y-4">
      {/* Strategie-Badge + Indikatoren */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-bold ${STRATEGIES.find(s => s.value === result.strategy)?.color ?? "text-white"}`}>
          {result.strategy_name}
        </span>
        {(result.indicators_used ?? []).map(ind => (
          <span key={ind} className="text-xs bg-slate-700/60 text-slate-300 border border-slate-600/40 rounded px-2 py-0.5">
            {ind}
          </span>
        ))}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Win-Rate" value={`${result.win_rate ?? 0}%`}
          color={(result.win_rate ?? 0) >= 50 ? "text-green-400" : "text-red-400"} />
        <StatCard label="Profit Factor" value={((result.profit_factor ?? 0)).toFixed(2)}
          color={(result.profit_factor ?? 0) >= 1.2 ? "text-green-400" : (result.profit_factor ?? 0) >= 1 ? "text-yellow-400" : "text-red-400"} />
        <StatCard label="Total Return" value={`${(result.total_return_pct ?? 0) > 0 ? "+" : ""}${result.total_return_pct ?? 0}%`}
          color={(result.total_return_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
        <StatCard label="Max Drawdown" value={`-${result.max_drawdown_pct ?? 0}%`}
          color={(result.max_drawdown_pct ?? 0) < 10 ? "text-green-400" : (result.max_drawdown_pct ?? 0) < 20 ? "text-yellow-400" : "text-red-400"} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Trades Total" value={String(result.total_trades ?? 0)} />
        <StatCard label="Wins / Losses" value={`${result.wins ?? 0} / ${result.losses ?? 0}`} />
        <StatCard label="End-Balance" value={`$${(result.final_balance ?? 0).toFixed(0)}`} />
        <StatCard label="Sharpe Ratio" value={String(result.sharpe_ratio ?? "—")}
          color={(result.sharpe_ratio ?? 0) > 0.5 ? "text-green-400" : "text-slate-300"} />
      </div>

      <StatCard label="Net PnL" value={`${(result.total_pnl ?? 0) >= 0 ? "+" : ""}$${(result.total_pnl ?? 0).toFixed(2)}`}
        color={(result.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />

      <EquityCurve trades={result.trades ?? []} initial={result.initial_balance ?? 0} />

      {(result.trades ?? []).length > 0 && (
        <div className="rounded-lg border border-slate-700/40 overflow-hidden">
          <div className="bg-slate-800/60 px-3 py-2 text-xs text-slate-400 font-medium">
            Letzte {result.trades.length} Trades
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/40">
                  {["Richtung", "Entry", "Exit", "RSI@Entry", "PnL", "Balance", "Ergebnis"].map(h => (
                    <th key={h} className="text-left text-slate-400 px-3 py-1.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.trades ?? []).map((t, i) => (
                  <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="px-3 py-1.5">
                      <span className={`font-medium ${t.direction === "LONG" ? "text-green-400" : "text-red-400"}`}>
                        {t.direction === "LONG" ? "▲ LONG" : "▼ SHORT"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-300">{t.entry_price}</td>
                    <td className="px-3 py-1.5 text-slate-300">{t.exit_price}</td>
                    <td className="px-3 py-1.5 text-slate-400">
                      {t.indicators?.rsi != null ? `${t.indicators.rsi}` : "—"}
                    </td>
                    <td className={`px-3 py-1.5 font-medium ${(t.pnl_usd ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(t.pnl_usd ?? 0) >= 0 ? "+" : ""}${(t.pnl_usd ?? 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300">${t.balance.toFixed(0)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${t.result === "WIN" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                        {t.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BacktestingPanel() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [interval, setIntervalVal] = useState("1h");
  const [period, setPeriod] = useState("6mo");
  const [balance, setBalance] = useState("10000");
  const [strategy, setStrategy] = useState("rsi");
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [compareData, setCompareData] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "compare">("single");

  async function runBacktest() {
    setLoading(true); setError(null); setResult(null); setCompareData(null);
    try {
      const res = await fetch("/api/python/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, interval, period, strategy, initial_balance: Number(balance) }),
        cache: "no-store",
      });
      const data = await res.json();
      if (data.error && !data.trades) throw new Error(data.error);
      setResult(data);
      setMode("single");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  }

  async function runAllStrategies() {
    setComparing(true); setError(null); setResult(null); setCompareData(null);
    try {
      const res = await fetch("/api/python/backtest/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, interval, period: period === "6mo" ? "3mo" : period, initial_balance: Number(balance) }),
        cache: "no-store",
      });
      const data = await res.json();
      setCompareData(data);
      setMode("compare");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Vergleich fehlgeschlagen");
    } finally {
      setComparing(false);
    }
  }

  const selectedStrat = STRATEGIES.find(s => s.value === strategy);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg">📊</span>
        <h2 className="font-bold text-white text-sm">Python Backtesting Engine</h2>
        <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded px-2 py-0.5">
          ATR-basierte SL/TP
        </span>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Symbol</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
            className="w-full rounded bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1.5">
            {SYMBOLS.map(s => <option key={s} value={s}>{SYMBOL_META[s] ?? s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Interval</label>
          <select value={interval} onChange={(e) => setIntervalVal(e.target.value)}
            className="w-full rounded bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1.5">
            {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Periode</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1.5">
            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Start-Kapital</label>
          <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)}
            className="w-full rounded bg-slate-800 border border-slate-600 text-white text-xs px-2 py-1.5"
            min={1000} step={1000} />
        </div>
      </div>

      {/* Strategie-Auswahl */}
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Strategie</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {STRATEGIES.map(s => (
            <button key={s.value} onClick={() => setStrategy(s.value)}
              className={`rounded-lg border p-2 text-left transition-all ${strategy === s.value
                ? "border-blue-500/60 bg-blue-500/10"
                : "border-slate-700/40 bg-slate-800/40 hover:border-slate-600"}`}>
              <div className={`text-xs font-semibold ${s.color}`}>{s.label}</div>
              <div className="text-xs text-slate-500 mt-0.5 leading-tight">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button onClick={runBacktest} disabled={loading || comparing}
          className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm py-2 transition-colors">
          {loading ? "⏳ Läuft..." : `▶ ${selectedStrat?.label ?? "Backtest"} starten`}
        </button>
        <button onClick={runAllStrategies} disabled={loading || comparing}
          className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs px-3 py-2 transition-colors">
          {comparing ? "⏳" : "⚡ Alle 5 vergleichen"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-500/40 text-red-300 text-xs p-3">
          ⚠ {error}
        </div>
      )}

      {/* Ergebnisse */}
      {mode === "single" && result && <SingleResult result={result} />}
      {mode === "compare" && compareData && <CompareTable data={compareData} />}

      {(result || compareData) && (
        <div className="text-xs text-slate-500 text-center border-t border-slate-800 pt-2">
          {symbol} · {interval} · {period} · ATR SL/TP · 1% Risiko pro Trade
          <span className="ml-2 text-slate-600">→ Ergebnisse fliessen in Strategy Evolution ein</span>
        </div>
      )}
    </div>
  );
}
