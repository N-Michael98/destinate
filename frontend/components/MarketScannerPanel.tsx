"use client";
import { useState, useCallback, useEffect } from "react";

interface GPTAnalysis {
  direction: "BUY" | "SELL" | "WAIT";
  confidence: number;
  reasoning: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  tradingStyle: string;
  source: string;
}

interface ClaudeRisk {
  approved: boolean;
  riskScore: number;
  maxRiskPercent: number;
  reasoning: string;
  rewardRiskRatio: number;
  source: string;
}

interface Opportunity {
  rank: number;
  epic: string;
  symbol: string;
  instrumentName: string;
  bid: number;
  ask: number;
  spread: number;
  gpt: GPTAnalysis;
  claude: ClaudeRisk;
  finalScore: number;
  goSignal: boolean;
}

interface ScanResult {
  ok: boolean;
  capitalConnected: boolean;
  gptConnected: boolean;
  claudeConnected: boolean;
  totalMarkets: number;
  opportunities: Opportunity[];
  goSignals: Opportunity[];
  goCount: number;
  scannedAt: string;
}

interface ExecLog {
  id: string;
  ts: string;
  symbol: string;
  direction: string;
  ok: boolean;
  dealId?: string;
  error?: string;
}

const TYPE_FILTERS = ["ALL", "CURRENCIES", "INDICES", "COMMODITIES", "CRYPTOCURRENCIES"];
const DIR_COLORS: Record<string, string> = { BUY: "#10c96d", SELL: "#f87171", WAIT: "#64748b" };

function formatPrice(v: number): string {
  if (v === 0) return "—";
  if (v > 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v > 10) return v.toFixed(2);
  return v.toFixed(5);
}

export default function MarketScannerPanel() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScanRaw] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showGoOnly, setShowGoOnly] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [accountBalance, setAccountBalanceRaw] = useState(10000);
  const [realBalance, setRealBalance] = useState<{ balance: number; currency: string } | null>(null);
  const [execLogs, setExecLogs] = useState<ExecLog[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [autoExecLog, setAutoExecLog] = useState<string | null>(null);

  // Persist autoScan + balance across reloads
  useEffect(() => {
    try {
      const a = localStorage.getItem("scanner_autoScan");
      if (a !== null) setAutoScanRaw(a === "true");
      const b = localStorage.getItem("scanner_balance");
      if (b !== null) setAccountBalanceRaw(Number(b));
    } catch { /* ignore */ }
  }, []);

  // Fetch real Capital.com balance on mount
  useEffect(() => {
    fetch("/api/capital-com").then(r => r.json()).then(d => {
      if (d.connected && d.balance != null) {
        setRealBalance({ balance: d.balance, currency: d.currency ?? "USD" });
        if (d.balance > 0) setAccountBalanceRaw(d.balance);
      }
    }).catch(() => {});
  }, []);

  const setAutoScan = (val: boolean) => {
    setAutoScanRaw(val);
    try { localStorage.setItem("scanner_autoScan", String(val)); } catch { /* ignore */ }
  };

  const setAccountBalance = (val: number) => {
    setAccountBalanceRaw(val);
    try { localStorage.setItem("scanner_balance", String(val)); } catch { /* ignore */ }
  };

  const runScan = useCallback(async () => {
    setScanning(true);
    const types = typeFilter === "ALL" ? "CURRENCIES,INDICES,COMMODITIES,CRYPTOCURRENCIES" : typeFilter;
    const q = searchQ ? `&q=${encodeURIComponent(searchQ)}` : "";
    const r = await fetch(`/api/market-scanner?action=scan&types=${types}${q}`).catch(() => null);
    let scanData: ScanResult | null = null;
    if (r?.ok) {
      scanData = await r.json().catch(() => null);
      if (scanData) setResult(scanData);
    }
    setScanning(false);

    // Auto-execute if Bot Mode = AUTO — pass scan results directly, no re-scan
    const autoStatus = await fetch("/api/auto-execute").then(r => r.json()).catch(() => null);
    if (autoStatus?.botMode === "AUTO" && autoStatus?.capitalConnected) {
      const scanOpportunities = scanData?.opportunities ?? [];
      const execResult = await fetch("/api/auto-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunities: scanOpportunities }),
      }).then(r => r.json()).catch(() => null);
      if (execResult?.executed) {
        setAutoExecLog(`✅ AUTO: ${execResult.symbol} ${execResult.direction} @${execResult.confidence}% — Deal ${execResult.dealId}`);
        setExecLogs(p => [{ id: `auto-${Date.now()}`, ts: new Date().toLocaleTimeString(), symbol: execResult.symbol, direction: execResult.direction, ok: true, dealId: execResult.dealId }, ...p].slice(0, 15));
      } else if (execResult?.reason) {
        setAutoExecLog(`ℹ ${execResult.reason}`);
      }
    }
  }, [typeFilter, searchQ]);

  // Auto-scan every 60 seconds
  useEffect(() => {
    if (!autoScan) return;
    const t = setInterval(runScan, 60000);
    return () => clearInterval(t);
  }, [autoScan, runScan]);

  const executeGO = async (opp: Opportunity) => {
    if (executing) return;
    setExecuting(opp.epic);
    const r = await fetch("/api/capital-com/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: opp.symbol,
        direction: opp.gpt.direction,
        riskPercent: opp.claude.maxRiskPercent,
        accountBalance,
        confidence: opp.gpt.confidence,
        strategy: opp.gpt.tradingStyle,
        tradingStyle: opp.gpt.tradingStyle,
      }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({ ok: false, error: "Parse error" })) : { ok: false, error: "Network error" };
    setExecLogs((p) => [{
      id: `${Date.now()}`, ts: new Date().toLocaleTimeString(),
      symbol: opp.symbol, direction: opp.gpt.direction,
      ok: d.ok, dealId: d.dealId, error: d.error,
    }, ...p].slice(0, 15));
    setExecuting(null);
  };

  const filtered = (result?.opportunities ?? []).filter((o) => {
    if (showGoOnly && !o.goSignal) return false;
    return true;
  });

  const gptReal = result?.gptConnected;
  const claudeReal = result?.claudeConnected;

  return (
    <div style={{ padding: "24px", fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>🌍 Multi-Market Scanner</span>
            <span style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: "6px", padding: "2px 10px", fontSize: "11px", color: "#a5b4fc" }}>V17.5.0</span>
            {result && (
              <>
                <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px", background: result.capitalConnected ? "rgba(16,201,109,0.15)" : "rgba(100,116,139,0.12)", color: result.capitalConnected ? "#10c96d" : "#64748b", border: `1px solid ${result.capitalConnected ? "rgba(16,201,109,0.3)" : "rgba(100,116,139,0.2)"}` }}>
                  {result.capitalConnected ? "● Capital.com LIVE" : "○ Offline"}
                </span>
                <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px", background: gptReal ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.12)", color: gptReal ? "#10b981" : "#64748b", border: `1px solid ${gptReal ? "rgba(16,185,129,0.3)" : "rgba(100,116,139,0.2)"}` }}>
                  {gptReal ? "GPT REAL" : "GPT SIM"}
                </span>
                <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px", background: claudeReal ? "rgba(168,85,247,0.15)" : "rgba(100,116,139,0.12)", color: claudeReal ? "#a855f7" : "#64748b", border: `1px solid ${claudeReal ? "rgba(168,85,247,0.3)" : "rgba(100,116,139,0.2)"}` }}>
                  {claudeReal ? "CLAUDE REAL" : "CLAUDE SIM"}
                </span>
              </>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            Scannt alle Capital.com Märkte · GPT identifiziert Chancen · Claude bewertet Risiko · GO-Signal → sofort ausführen
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "#64748b" }}>Auto 60s:</span>
            <button onClick={() => setAutoScan(!autoScan)}
              style={{ width: "36px", height: "20px", borderRadius: "10px", border: "none", cursor: "pointer", background: autoScan ? "#10c96d" : "rgba(255,255,255,0.1)", position: "relative" }}>
              <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: autoScan ? "19px" : "3px", transition: "left 0.15s" }} />
            </button>
          </div>
          <button onClick={runScan} disabled={scanning}
            style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid rgba(99,102,241,0.4)", cursor: scanning ? "not-allowed" : "pointer", background: scanning ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.2)", color: "#a5b4fc", fontSize: "12px", fontFamily: "monospace", fontWeight: 700 }}>
            {scanning ? "Scanne..." : "▶ Scan Alle Märkte"}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Suche: gold, eur, btc..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runScan()}
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "6px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", width: "180px" }}
        />
        <div style={{ display: "flex", gap: "4px" }}>
          {TYPE_FILTERS.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: "5px 10px", borderRadius: "5px", border: "none", cursor: "pointer", fontSize: "10px", fontFamily: "monospace", fontWeight: 600, background: typeFilter === t ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", color: typeFilter === t ? "#a5b4fc" : "#64748b" }}>
              {t === "ALL" ? "Alle" : t === "CRYPTOCURRENCIES" ? "CRYPTO" : t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowGoOnly((p) => !p)}
          style={{ padding: "5px 12px", borderRadius: "5px", border: `1px solid ${showGoOnly ? "rgba(16,201,109,0.4)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", fontSize: "10px", fontFamily: "monospace", background: showGoOnly ? "rgba(16,201,109,0.15)" : "rgba(255,255,255,0.05)", color: showGoOnly ? "#10c96d" : "#64748b" }}>
          {showGoOnly ? "✓ Nur GO" : "Nur GO"}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          {realBalance ? (
            <span style={{ fontSize: "10px", color: "#10c96d", background: "rgba(16,201,109,0.1)", border: "1px solid rgba(16,201,109,0.25)", borderRadius: "5px", padding: "4px 8px" }}>
              ● {realBalance.currency} {realBalance.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          ) : (
            <>
              <label style={{ fontSize: "10px", color: "#64748b" }}>Balance (USD):</label>
              <input type="number" value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))}
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "5px 8px", color: "#f1f5f9", fontSize: "11px", fontFamily: "monospace", width: "100px", outline: "none" }} />
            </>
          )}
        </div>
      </div>

      {/* Auto-Execute Status */}
      {autoExecLog && (
        <div style={{ marginBottom: "12px", padding: "8px 14px", background: autoExecLog.startsWith("✅") ? "rgba(16,201,109,0.08)" : "rgba(99,102,241,0.08)", border: `1px solid ${autoExecLog.startsWith("✅") ? "rgba(16,201,109,0.25)" : "rgba(99,102,241,0.2)"}`, borderRadius: "6px", fontSize: "11px", color: autoExecLog.startsWith("✅") ? "#10c96d" : "#94a3b8", fontFamily: "monospace" }}>
          🤖 AUTO-EXECUTE: {autoExecLog}
        </div>
      )}

      {/* Summary bar */}
      {result && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          {[
            { label: "Märkte", value: result.totalMarkets, color: "#94a3b8" },
            { label: "Analysiert", value: result.opportunities.length, color: "#a5b4fc" },
            { label: "GO Signale", value: result.goCount, color: "#10c96d" },
            { label: "BUY", value: result.opportunities.filter((o) => o.gpt.direction === "BUY").length, color: "#10c96d" },
            { label: "SELL", value: result.opportunities.filter((o) => o.gpt.direction === "SELL").length, color: "#f87171" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize: "18px", fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: "10px", color: "#475569", marginLeft: "6px" }}>{s.label}</span>
            </div>
          ))}
          <div style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontSize: "10px", color: "#475569" }}>Letzter Scan: {new Date(result.scannedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Market grid */}
      {!result && !scanning && (
        <div style={{ padding: "60px", textAlign: "center", color: "#475569" }}>
          Klicke "▶ Scan Alle Märkte" — GPT und Claude analysieren alle verfügbaren Capital.com Instrumente
        </div>
      )}

      {scanning && (
        <div style={{ padding: "40px", textAlign: "center", color: "#a5b4fc", fontSize: "14px" }}>
          <div style={{ marginBottom: "8px" }}>Scanne Capital.com Märkte · GPT analysiert · Claude bewertet Risk...</div>
          <div style={{ fontSize: "11px", color: "#475569" }}>Je nach Marktanzahl dauert dies 10-30 Sekunden</div>
        </div>
      )}

      {!scanning && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          {filtered.map((opp) => (
            <div key={opp.epic}
              onClick={() => setSelectedOpp(selectedOpp?.epic === opp.epic ? null : opp)}
              style={{
                background: opp.goSignal ? "rgba(16,201,109,0.06)" : "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                border: `1px solid ${opp.goSignal ? "rgba(16,201,109,0.35)" : "rgba(255,255,255,0.07)"}`,
                padding: "14px", cursor: "pointer",
                outline: selectedOpp?.epic === opp.epic ? "2px solid #6366f1" : "none",
                transition: "border 0.15s",
              }}>
              {/* Row 1: Symbol + Direction + GO badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>#{opp.rank} {opp.symbol}</span>
                  <span style={{ padding: "1px 7px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                    background: `${DIR_COLORS[opp.gpt.direction]}22`,
                    color: DIR_COLORS[opp.gpt.direction],
                    border: `1px solid ${DIR_COLORS[opp.gpt.direction]}44` }}>
                    {opp.gpt.direction}
                  </span>
                  {opp.goSignal && (
                    <span style={{ padding: "1px 7px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(16,201,109,0.2)", color: "#10c96d", border: "1px solid rgba(16,201,109,0.4)" }}>
                      ⚡ GO
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: "#a5b4fc", fontWeight: 700 }}>
                  {(opp.finalScore ?? 0).toFixed(0)} pts
                </div>
              </div>

              {/* Row 2: Name + prices */}
              <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "8px" }}>
                {opp.instrumentName} · {formatPrice(opp.bid)} / {formatPrice(opp.ask)}
              </div>

              {/* Row 3: Confidence + Risk bars */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "9px", color: "#475569", marginBottom: "2px" }}>GPT {opp.gpt.confidence}%</div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                    <div style={{ height: "100%", width: `${opp.gpt.confidence}%`, background: opp.gpt.confidence >= 70 ? "#10c96d" : opp.gpt.confidence >= 55 ? "#fbbf24" : "#f87171", borderRadius: "2px" }} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "9px", color: "#475569", marginBottom: "2px" }}>Risk {opp.claude.riskScore}</div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                    <div style={{ height: "100%", width: `${opp.claude.riskScore}%`, background: opp.claude.riskScore < 40 ? "#10c96d" : opp.claude.riskScore < 65 ? "#fbbf24" : "#f87171", borderRadius: "2px" }} />
                  </div>
                </div>
                <div style={{ fontSize: "10px", color: (opp.claude.rewardRiskRatio ?? 0) >= 2 ? "#10c96d" : (opp.claude.rewardRiskRatio ?? 0) >= 1.5 ? "#fbbf24" : "#f87171" }}>
                  R/R {(opp.claude.rewardRiskRatio ?? 0).toFixed(1)}
                </div>
              </div>

              {/* Style + source badges */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>{opp.gpt.tradingStyle}</span>
                <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: opp.gpt.source === "GPT_REAL" ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.1)", color: opp.gpt.source === "GPT_REAL" ? "#10b981" : "#475569" }}>{opp.gpt.source}</span>
                <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: opp.claude.source === "CLAUDE_REAL" ? "rgba(168,85,247,0.15)" : "rgba(100,116,139,0.1)", color: opp.claude.source === "CLAUDE_REAL" ? "#a855f7" : "#475569" }}>{opp.claude.source}</span>
              </div>

              {/* Execute button */}
              {opp.goSignal && result?.capitalConnected && (
                <button onClick={(e) => { e.stopPropagation(); executeGO(opp); }}
                  disabled={executing === opp.epic}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid rgba(16,201,109,0.4)", cursor: "pointer", background: "rgba(16,201,109,0.18)", color: "#10c96d", fontSize: "11px", fontFamily: "monospace", fontWeight: 700, opacity: executing === opp.epic ? 0.6 : 1 }}>
                  {executing === opp.epic ? "Ausführe..." : `▶ GO — ${opp.gpt.direction} ${opp.symbol}`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedOpp && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(99,102,241,0.3)", padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>{selectedOpp.instrumentName} ({selectedOpp.symbol}) — Detail</span>
            <button onClick={() => setSelectedOpp(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 700, marginBottom: "6px" }}>GPT Analyse</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.6 }}>
                <div>Richtung: <strong style={{ color: DIR_COLORS[selectedOpp.gpt.direction] }}>{selectedOpp.gpt.direction}</strong></div>
                <div>Confidence: {selectedOpp.gpt.confidence}%</div>
                <div>Entry: {formatPrice(selectedOpp.gpt.entry)}</div>
                <div>Stop Loss: {formatPrice(selectedOpp.gpt.stopLoss)}</div>
                <div>Take Profit: {formatPrice(selectedOpp.gpt.takeProfit)}</div>
                <div>Style: {selectedOpp.gpt.tradingStyle}</div>
                <div style={{ marginTop: "6px", color: "#64748b", fontSize: "10px" }}>{selectedOpp.gpt.reasoning}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#a855f7", fontWeight: 700, marginBottom: "6px" }}>Claude Risiko</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.6 }}>
                <div>Freigabe: <strong style={{ color: selectedOpp.claude.approved ? "#10c96d" : "#f87171" }}>{selectedOpp.claude.approved ? "APPROVED" : "REJECTED"}</strong></div>
                <div>Risk Score: {selectedOpp.claude.riskScore}/100</div>
                <div>Max Risk: {selectedOpp.claude.maxRiskPercent}%</div>
                <div>R/R Ratio: {(selectedOpp.claude.rewardRiskRatio ?? 0).toFixed(2)}</div>
                <div style={{ marginTop: "6px", color: "#64748b", fontSize: "10px" }}>{selectedOpp.claude.reasoning}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Log */}
      {execLogs.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", padding: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "8px" }}>📜 Execution Log</div>
          {execLogs.map((log) => (
            <div key={log.id} style={{ display: "flex", gap: "10px", fontSize: "11px", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span style={{ color: "#475569", minWidth: "60px" }}>{log.ts}</span>
              <span style={{ color: log.ok ? "#10c96d" : "#f87171" }}>{log.ok ? "✓" : "✗"}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 700, minWidth: "70px" }}>{log.symbol}</span>
              <span style={{ color: DIR_COLORS[log.direction] ?? "#94a3b8", minWidth: "40px" }}>{log.direction}</span>
              {log.dealId && <span style={{ color: "#475569" }}>Deal: {log.dealId}</span>}
              {log.error && <span style={{ color: "#f87171" }}>{log.error}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "14px", padding: "10px 14px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "8px", fontSize: "10px", color: "#475569" }}>
        ℹ GPT analysiert bis zu 30 Märkte pro Scan in einem einzigen API-Call · Claude bewertet Risk pro Opportunity ·
        GO-Signal = GPT Confidence ≥ 65% + Claude Approved + R/R ≥ 1.5 · Alle Orders auf Capital.com DEMO
      </div>
    </div>
  );
}
