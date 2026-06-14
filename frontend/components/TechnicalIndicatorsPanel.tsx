"use client";
import { useEffect, useState } from "react";
import type { TechnicalAnalysisReport, IndicatorSummary, IndicatorSignal } from "../lib/technical-indicators";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const TIMEFRAMES = ["M15", "H1", "H4", "D1"];
const SYMBOLS = ["XAUUSD", "EURUSD", "NAS100", "USOIL", "BTCUSD", "SPX500"];

function signalColor(s: IndicatorSignal) {
  return s === "BUY" ? "#10c96d" : s === "SELL" ? "#f87171" : "#94a3b8";
}
function signalBg(s: IndicatorSignal) {
  return s === "BUY" ? "rgba(16,201,109,0.12)" : s === "SELL" ? "rgba(248,113,113,0.12)" : "rgba(148,163,184,0.08)";
}

function SignalBadge({ signal }: { signal: IndicatorSignal }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
      background: signalBg(signal), color: signalColor(signal),
      border: `1px solid ${signalColor(signal)}44`,
    }}>
      {signal}
    </span>
  );
}

function IndicatorRow({ label, value, signal, extra }: { label: string; value: string; signal: IndicatorSignal; extra?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{ fontSize: "11px", color: "#64748b" }}>{label}</span>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {extra && <span style={{ fontSize: "10px", color: "#475569" }}>{extra}</span>}
        <span style={{ fontSize: "11px", color: "#f1f5f9", fontWeight: 600 }}>{value}</span>
        <SignalBadge signal={signal} />
      </div>
    </div>
  );
}

function SymbolCard({ summary, selected, onClick }: { summary: IndicatorSummary; selected: boolean; onClick: () => void }) {
  const c = signalColor(summary.overallSignal);
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? signalBg(summary.overallSignal) : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? c + "66" : "rgba(255,255,255,0.08)"}`,
        borderRadius: "8px", padding: "12px", cursor: "pointer", textAlign: "left",
        transition: "all 0.15s", fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "13px" }}>{summary.symbol}</span>
        <SignalBadge signal={summary.overallSignal} />
      </div>
      <div style={{ fontSize: "10px", color: "#64748b" }}>
        Confluence: <span style={{ color: c, fontWeight: 700 }}>{summary.confluenceScore}%</span>
        {" · "}{summary.bullishCount}↑ {summary.bearishCount}↓
      </div>
      <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
        RSI {summary.rsi.value} · ATR {summary.atr.volatilityLevel}
      </div>
    </button>
  );
}

function RadarData(s: IndicatorSummary) {
  const rsiScore = s.rsi.value > 50 ? ((s.rsi.value - 50) / 50) * 100 : 0;
  return [
    { subject: "EMA Trend", score: s.ema.ema50.signal === "BUY" ? 80 : 20 },
    { subject: "RSI", score: Math.round(rsiScore) },
    { subject: "MACD", score: s.macd.signal === "BUY" ? 75 : 25 },
    { subject: "BB %B", score: Math.round(s.bollingerBands.percentB * 100) },
    { subject: "Stoch", score: Math.round(s.stochastic.kValue) },
    { subject: "Confluence", score: s.confluenceScore },
  ];
}

export default function TechnicalIndicatorsPanel() {
  const [report, setReport] = useState<TechnicalAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("H1");

  const load = async (tf: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/technical-analysis?timeframe=${tf}`);
      const d = await r.json();
      if (d.ok) setReport(d.report);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(timeframe); }, [timeframe]);

  const summary = report?.symbols.find((s) => s.symbol === selectedSymbol);

  const formatPrice = (v: number, sym: string) =>
    sym === "EURUSD" ? v.toFixed(5) : sym === "BTCUSD" ? v.toFixed(0) : v.toFixed(2);

  return (
    <div style={{ padding: "24px", fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>📊 Technical Indicators</span>
            <span style={{
              background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "6px", padding: "2px 10px", fontSize: "11px", color: "#a5b4fc"
            }}>V17.2.0</span>
            {report && (
              <span style={{
                background: "rgba(16,201,109,0.1)", border: "1px solid rgba(16,201,109,0.3)",
                borderRadius: "6px", padding: "2px 10px", fontSize: "11px", color: "#10c96d"
              }}>
                {report.marketBias.replace("_", " ")}
              </span>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            EMA · SMA · RSI · MACD · Bollinger Bands · ATR · Stochastic · VWAP
          </div>
        </div>

        {/* Timeframe selector */}
        <div style={{ display: "flex", gap: "4px" }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: "6px 12px", borderRadius: "6px", border: "none", cursor: "pointer",
                background: timeframe === tf ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                color: timeframe === tf ? "#a5b4fc" : "#64748b",
                fontSize: "11px", fontFamily: "monospace", fontWeight: 600,
                borderBottom: timeframe === tf ? "2px solid #6366f1" : "2px solid transparent",
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: "20px", color: "#64748b", fontSize: "12px" }}>Berechne Indikatoren...</div>
      )}

      {!loading && report && (
        <>
          {/* Symbol grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", marginBottom: "20px" }}>
            {report.symbols.map((s) => (
              <SymbolCard
                key={s.symbol}
                summary={s}
                selected={selectedSymbol === s.symbol}
                onClick={() => setSelectedSymbol(s.symbol)}
              />
            ))}
          </div>

          {/* Market Bias Bar */}
          <div style={{
            display: "flex", gap: "16px", marginBottom: "20px",
            background: "rgba(255,255,255,0.03)", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px",
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "11px", color: "#64748b" }}>MARKET BIAS:</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: report.marketBias.startsWith("RISK_ON") ? "#10c96d" : report.marketBias === "RISK_OFF" ? "#f87171" : "#94a3b8" }}>
              {report.marketBias.replace("_", " ")}
            </span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>|</span>
            <span style={{ fontSize: "11px", color: "#10c96d" }}>BULLISH: {report.topBullish.join(", ") || "—"}</span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>|</span>
            <span style={{ fontSize: "11px", color: "#f87171" }}>BEARISH: {report.topBearish.join(", ") || "—"}</span>
          </div>

          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              {/* EMA / SMA Panel */}
              <div style={{
                background: "rgba(255,255,255,0.03)", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)", padding: "16px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>
                  📈 Moving Averages — {summary.symbol}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                  Price: <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{formatPrice(summary.currentPrice, summary.symbol)}</span>
                </div>
                <IndicatorRow label="EMA 9" value={formatPrice(summary.ema.ema9.value, summary.symbol)} signal={summary.ema.ema9.signal} extra={summary.ema.ema9.crossover !== "NONE" ? summary.ema.ema9.crossover : undefined} />
                <IndicatorRow label="EMA 21" value={formatPrice(summary.ema.ema21.value, summary.symbol)} signal={summary.ema.ema21.signal} extra={summary.ema.ema21.crossover !== "NONE" ? summary.ema.ema21.crossover : undefined} />
                <IndicatorRow label="EMA 50" value={formatPrice(summary.ema.ema50.value, summary.symbol)} signal={summary.ema.ema50.signal} />
                <IndicatorRow label="EMA 200" value={formatPrice(summary.ema.ema200.value, summary.symbol)} signal={summary.ema.ema200.signal} />
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
                <IndicatorRow label="SMA 20" value={formatPrice(summary.sma.sma20.value, summary.symbol)} signal={summary.sma.sma20.signal} />
                <IndicatorRow label="SMA 50" value={formatPrice(summary.sma.sma50.value, summary.symbol)} signal={summary.sma.sma50.signal} />
                <IndicatorRow label="SMA 200" value={formatPrice(summary.sma.sma200.value, summary.symbol)} signal={summary.sma.sma200.signal} />
                <IndicatorRow label="VWAP" value={formatPrice(summary.vwap.value, summary.symbol)} signal={summary.vwap.signal} extra={summary.vwap.priceRelation} />
              </div>

              {/* Oscillators */}
              <div style={{
                background: "rgba(255,255,255,0.03)", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)", padding: "16px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>
                  🔄 Oscillatoren — {summary.symbol}
                </div>

                {/* RSI Gauge */}
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>RSI (14)</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: signalColor(summary.rsi.signal) }}>
                      {summary.rsi.value} — {summary.rsi.zone}
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${summary.rsi.value}%`,
                      background: summary.rsi.value > 70 ? "#f87171" : summary.rsi.value < 30 ? "#10c96d" : "#6366f1",
                      borderRadius: "3px",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#475569", marginTop: "2px" }}>
                    <span>0 — OVERSOLD</span><span>50</span><span>OVERBOUGHT — 100</span>
                  </div>
                </div>

                <IndicatorRow
                  label="MACD Line"
                  value={(summary.macd.macdLine ?? 0).toFixed(4)}
                  signal={summary.macd.signal}
                  extra={summary.macd.crossover}
                />
                <IndicatorRow label="MACD Hist." value={(summary.macd.histogram ?? 0).toFixed(4)} signal={(summary.macd.histogram ?? 0) >= 0 ? "BUY" : "SELL"} />

                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />

                {/* Stochastic */}
                <div style={{ marginBottom: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Stochastic %K</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: signalColor(summary.stochastic.signal) }}>
                      {summary.stochastic.kValue} — {summary.stochastic.zone}
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${summary.stochastic.kValue}%`,
                      background: summary.stochastic.kValue > 80 ? "#f87171" : summary.stochastic.kValue < 20 ? "#10c96d" : "#fbbf24",
                      borderRadius: "3px",
                    }} />
                  </div>
                </div>
                <IndicatorRow label="Stoch %D" value={`${summary.stochastic.dValue}`} signal={summary.stochastic.signal} extra={summary.stochastic.crossover !== "NONE" ? summary.stochastic.crossover : undefined} />
              </div>

              {/* Volatility + Radar */}
              <div style={{
                background: "rgba(255,255,255,0.03)", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)", padding: "16px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>
                  ⚡ Volatilität & Confluence
                </div>

                {/* ATR */}
                <div style={{ marginBottom: "12px", padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "4px" }}>ATR (14) — Avg True Range</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#fbbf24" }}>{(summary.atr.value ?? 0).toFixed(summary.symbol === "EURUSD" ? 5 : 2)}</div>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>Volatilität: <span style={{
                    color: summary.atr.volatilityLevel === "EXTREME" ? "#f87171" : summary.atr.volatilityLevel === "HIGH" ? "#fbbf24" : "#10c96d"
                  }}>{summary.atr.volatilityLevel}</span></div>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>Stop-Vorschlag: {formatPrice(summary.atr.suggestedStopPips, summary.symbol)} ({summary.symbol === "EURUSD" ? "pips" : "pts"})</div>
                </div>

                {/* Bollinger Bands */}
                <IndicatorRow label="BB Upper" value={formatPrice(summary.bollingerBands.upper, summary.symbol)} signal="SELL" />
                <IndicatorRow label="BB Middle" value={formatPrice(summary.bollingerBands.middle, summary.symbol)} signal="NEUTRAL" />
                <IndicatorRow label="BB Lower" value={formatPrice(summary.bollingerBands.lower, summary.symbol)} signal="BUY" />
                <IndicatorRow
                  label="BB %B"
                  value={`${(summary.bollingerBands.percentB * 100).toFixed(1)}%`}
                  signal={summary.bollingerBands.signal}
                  extra={summary.bollingerBands.squeeze ? "SQUEEZE" : undefined}
                />

                {/* Overall confluence */}
                <div style={{ marginTop: "12px", padding: "10px", background: signalBg(summary.overallSignal), borderRadius: "8px",
                  border: `1px solid ${signalColor(summary.overallSignal)}33` }}>
                  <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "4px" }}>Overall Confluence</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: signalColor(summary.overallSignal) }}>
                      {summary.confluenceScore}%
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: signalColor(summary.overallSignal) }}>
                        {summary.overallSignal}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>{summary.overallStrength}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                    {summary.bullishCount} bullish · {summary.bearishCount} bearish · {summary.neutralCount} neutral
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multi-symbol confluence table */}
          <div style={{
            marginTop: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.08)", padding: "16px",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>
              📋 Alle Symbole — Indikator-Übersicht ({timeframe})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr>
                    {["Symbol", "Price", "EMA9", "EMA50", "EMA200", "RSI", "MACD", "BB %B", "Stoch", "ATR", "Confluence", "Signal"].map((h) => (
                      <th key={h} style={{
                        padding: "6px 10px", textAlign: "left", color: "#64748b",
                        fontSize: "10px", textTransform: "uppercase", fontWeight: 600,
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.symbols.map((s, i) => (
                    <tr
                      key={s.symbol}
                      onClick={() => setSelectedSymbol(s.symbol)}
                      style={{
                        background: selectedSymbol === s.symbol ? signalBg(s.overallSignal) : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#f1f5f9" }}>{s.symbol}</td>
                      <td style={{ padding: "8px 10px", color: "#e2e8f0" }}>{formatPrice(s.currentPrice, s.symbol)}</td>
                      <td style={{ padding: "8px 10px" }}><SignalBadge signal={s.ema.ema9.signal} /></td>
                      <td style={{ padding: "8px 10px" }}><SignalBadge signal={s.ema.ema50.signal} /></td>
                      <td style={{ padding: "8px 10px" }}><SignalBadge signal={s.ema.ema200.signal} /></td>
                      <td style={{ padding: "8px 10px", color: s.rsi.value > 70 ? "#f87171" : s.rsi.value < 30 ? "#10c96d" : "#94a3b8" }}>
                        {s.rsi.value}
                      </td>
                      <td style={{ padding: "8px 10px" }}><SignalBadge signal={s.macd.signal} /></td>
                      <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{(s.bollingerBands.percentB * 100).toFixed(0)}%</td>
                      <td style={{ padding: "8px 10px" }}><SignalBadge signal={s.stochastic.signal} /></td>
                      <td style={{ padding: "8px 10px", color: "#fbbf24" }}>{s.atr.volatilityLevel}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
                            <div style={{ height: "100%", width: `${s.confluenceScore}%`, background: signalColor(s.overallSignal), borderRadius: "2px" }} />
                          </div>
                          <span style={{ color: "#94a3b8", minWidth: "28px" }}>{s.confluenceScore}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px" }}><SignalBadge signal={s.overallSignal} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {report && (
            <div style={{ marginTop: "12px", fontSize: "10px", color: "#475569", textAlign: "right" }}>
              Generiert: {new Date(report.generatedAt).toLocaleString()} · Zeitrahmen: {timeframe}
              {" · "}Hinweis: Simulierte Preiswerte — Real-Daten nach Broker-Verbindung aktiv
            </div>
          )}
        </>
      )}
    </div>
  );
}
