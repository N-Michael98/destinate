"use client";

import { useEffect, useState } from "react";

type Price = {
  symbol: string;
  price: number | null;
  currency?: string;
  error?: string;
};

type IndicatorData = {
  symbol: string;
  price: number | null;
  trend: string;
  indicators: {
    rsi: { value: number | null; signal: string };
    macd: { macd: number | null; hist: number | null };
    ema: { ema20: number | null; ema50: number | null };
    atr: number | null;
  };
};

const SYMBOLS = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "NAS100", "OIL"];

const SYMBOL_META: Record<string, { label: string; icon: string }> = {
  EURUSD: { label: "EUR/USD", icon: "💶" },
  GBPUSD: { label: "GBP/USD", icon: "💷" },
  XAUUSD: { label: "Gold", icon: "🥇" },
  BTCUSD: { label: "Bitcoin", icon: "₿" },
  NAS100: { label: "Nasdaq 100", icon: "📈" },
  OIL:    { label: "Crude Oil", icon: "🛢" },
};

function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    BULLISH:  { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "↑ BULLISH" },
    BEARISH:  { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  label: "↓ BEARISH" },
    NEUTRAL:  { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", label: "→ NEUTRAL" },
  };
  const s = map[trend] ?? map.NEUTRAL;
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function RsiBar({ value, signal }: { value: number | null; signal: string }) {
  const v = value ?? 50;
  const color = signal === "OVERBOUGHT" ? "#ef4444" : signal === "OVERSOLD" ? "#10b981" : "#6366f1";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontSize: "10px", color: "#64748b", width: "26px" }}>RSI</span>
      <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", position: "relative" }}>
        <div style={{ position: "absolute", left: `${Math.min(v, 100)}%`, top: "-3px", width: "8px", height: "8px", borderRadius: "50%", background: color, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", left: "30%", width: "1px", height: "4px", background: "rgba(255,255,255,0.15)" }} />
        <div style={{ position: "absolute", left: "70%", width: "1px", height: "4px", background: "rgba(255,255,255,0.15)" }} />
      </div>
      <span style={{ fontSize: "10px", color, fontFamily: "monospace", width: "28px", textAlign: "right" }}>{v.toFixed(1)}</span>
    </div>
  );
}

export default function LiveMarketWidget() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [indicators, setIndicators] = useState<IndicatorData[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [priceRes, taRes, healthRes] = await Promise.all([
        fetch(`/api/market-data/prices?symbols=${SYMBOLS.join(",")}`, { cache: "no-store" }),
        fetch(`/api/technical-analysis?symbols=${SYMBOLS.join(",")}&interval=1h&period=1mo`, { cache: "no-store" }),
        fetch("/api/market-data/health", { cache: "no-store" }),
      ]);

      const [priceData, taData, healthData] = await Promise.all([
        priceRes.json(), taRes.json(), healthRes.json(),
      ]);

      setBackendOnline(healthData.ok ?? false);
      if (priceData.prices) setPrices(priceData.prices);
      if (taData.symbols) setIndicators(taData.symbols);
      setLastUpdate(new Date().toLocaleTimeString("de-CH"));
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const priceMap = Object.fromEntries(prices.map((p) => [p.symbol, p]));
  const indicMap = Object.fromEntries(indicators.map((i) => [i.symbol, i]));

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>📡 Live Marktdaten</span>
          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px",
            background: backendOnline ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            color: backendOnline ? "#10b981" : "#ef4444",
            fontWeight: 700 }}>
            {backendOnline === null ? "..." : backendOnline ? "● PYTHON LIVE" : "● OFFLINE"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lastUpdate && <span style={{ fontSize: "10px", color: "#475569" }}>Update: {lastUpdate}</span>}
          <button onClick={load} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", fontSize: "11px", cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "24px", color: "#475569", fontSize: "13px" }}>
          Lade Marktdaten von Python Backend...
        </div>
      )}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {SYMBOLS.map((sym) => {
            const p = priceMap[sym];
            const ind = indicMap[sym];
            const meta = SYMBOL_META[sym] ?? { label: sym, icon: "📊" };
            const price = p?.price ?? ind?.price;
            const trend = ind?.trend ?? "NEUTRAL";
            const rsi = ind?.indicators?.rsi;
            const macdHist = ind?.indicators?.macd?.hist ?? 0;

            return (
              <div key={sym} style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "14px",
              }}>
                {/* Symbol Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "16px" }}>{meta.icon}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace" }}>{meta.label}</span>
                  </div>
                  <TrendBadge trend={trend} />
                </div>

                {/* Price */}
                <div style={{ marginBottom: "10px" }}>
                  {price != null ? (
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
                      {price < 10 ? price.toFixed(5) : price < 1000 ? price.toFixed(3) : price.toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ fontSize: "13px", color: "#475569" }}>— Keine Daten</span>
                  )}
                </div>

                {/* RSI */}
                {rsi && <div style={{ marginBottom: "6px" }}><RsiBar value={rsi.value} signal={rsi.signal} /></div>}

                {/* MACD Signal */}
                {ind && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>MACD</span>
                    <span style={{ fontSize: "10px", color: macdHist > 0 ? "#10b981" : "#ef4444", fontFamily: "monospace" }}>
                      {macdHist > 0 ? "▲" : "▼"} {Math.abs(macdHist).toFixed(5)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !backendOnline && (
        <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "12px", color: "#f87171" }}>
          ⚠ Python Backend offline — starte <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: "3px" }}>backend/start.bat</code> um Live-Daten zu aktivieren.
        </div>
      )}
    </div>
  );
}
