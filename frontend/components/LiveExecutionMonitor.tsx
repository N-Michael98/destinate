"use client";
import { useEffect, useState, useCallback } from "react";

interface QueueItem {
  id: string;
  rank: number;
  symbol: string;
  strategy: string;
  direction: string;
  adaptiveConfidence: number;
  priorityScore: number;
  riskPerTradePercent: number;
  maxRiskAmount: number;
  brokerTarget: string;
  executionMode: string;
  reason: string;
}

interface QueueReport {
  version: string;
  queuedTrades: number;
  blockedTrades: number;
  brokerMode: string;
  executionMode: string;
  capitalComActive: boolean;
  icMarketsActive: boolean;
  bestQueueItem: QueueItem | null;
  queue: QueueItem[];
  recommendation: string;
  updatedAt: string;
}

interface OpenPosition {
  dealId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  size: number;
  openLevel: number;
  profitLoss: number;
  currency: string;
  createdDate: string;
}

interface ExecutionLog {
  id: string;
  ts: string;
  symbol: string;
  direction: string;
  size: number;
  broker: string;
  dealId?: string;
  ok: boolean;
  error?: string;
}

export default function LiveExecutionMonitor() {
  const [queue, setQueue] = useState<QueueReport | null>(null);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [execLogs, setExecLogs] = useState<ExecutionLog[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [autoExec, setAutoExecRaw] = useState(false);
  const [accountBalance, setAccountBalanceRaw] = useState(10000);
  const [refreshing, setRefreshing] = useState(false);

  // Persist toggle + balance across page reloads
  useEffect(() => {
    try {
      const saved = localStorage.getItem("liveExec_autoExec");
      if (saved !== null) setAutoExecRaw(saved === "true");
      const bal = localStorage.getItem("liveExec_accountBalance");
      if (bal !== null) setAccountBalanceRaw(Number(bal));
    } catch { /* localStorage unavailable */ }
  }, []);

  const setAutoExec = (val: boolean | ((p: boolean) => boolean)) => {
    setAutoExecRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try { localStorage.setItem("liveExec_autoExec", String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const setAccountBalance = (val: number) => {
    setAccountBalanceRaw(val);
    try { localStorage.setItem("liveExec_accountBalance", String(val)); } catch { /* ignore */ }
  };

  const loadQueue = useCallback(async () => {
    const r = await fetch("/api/execution-queue-position-sync").catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => null);
    if (d) setQueue(d.report ?? d);
  }, []);

  const loadPositions = useCallback(async () => {
    const r = await fetch("/api/capital-com/positions").catch(() => null);
    if (!r?.ok) return;
    const d = await r.json().catch(() => null);
    if (d?.positions) setPositions(d.positions);
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadQueue(), loadPositions()]);
    setRefreshing(false);
  }, [loadQueue, loadPositions]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const executeOrder = async (item: QueueItem) => {
    if (executing) return;
    setExecuting(item.id);

    const r = await fetch("/api/capital-com/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: item.symbol,
        direction: item.direction as "BUY" | "SELL",
        riskPercent: item.riskPerTradePercent,
        accountBalance,
        confidence: item.adaptiveConfidence,
        strategy: item.strategy,
        tradingStyle: "DAYTRADING",
      }),
    }).catch(() => null);

    const d = r ? await r.json().catch(() => ({ ok: false, error: "Parse error" })) : { ok: false, error: "Network error" };

    const log: ExecutionLog = {
      id: `log-${Date.now()}`,
      ts: new Date().toLocaleTimeString(),
      symbol: item.symbol,
      direction: item.direction,
      size: d.size ?? 0,
      broker: "Capital.com DEMO",
      dealId: d.dealId,
      ok: d.ok,
      error: d.error,
    };
    setExecLogs((prev) => [log, ...prev].slice(0, 20));
    setExecuting(null);
    await loadPositions();
  };

  const closePosition = async (dealId: string) => {
    const r = await fetch(`/api/capital-com/positions?dealId=${dealId}`, { method: "DELETE" }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (d?.ok) await loadPositions();
  };

  const capitalActive = queue?.capitalComActive ?? false;
  const totalPnL = positions.reduce((sum, p) => sum + p.profitLoss, 0);

  return (
    <div style={{ padding: "24px", fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>⚡ Live Execution Monitor</span>
            <span style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: "6px", padding: "2px 10px", fontSize: "11px", color: "#a5b4fc" }}>V17.4.0</span>
            <span style={{
              padding: "2px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 700,
              background: capitalActive ? "rgba(16,201,109,0.15)" : "rgba(100,116,139,0.15)",
              color: capitalActive ? "#10c96d" : "#64748b",
              border: `1px solid ${capitalActive ? "rgba(16,201,109,0.3)" : "rgba(100,116,139,0.2)"}`,
            }}>
              {capitalActive ? "● Capital.com DEMO" : "○ Paper Mode"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            GO-Signale werden direkt auf Capital.com DEMO ausgeführt · Kein Live-Trading
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={loadAll} disabled={refreshing}
            style={{ padding: "7px 14px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: "11px", fontFamily: "monospace" }}>
            {refreshing ? "..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Account Balance Input */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "11px", color: "#64748b" }}>Account Balance (USD):</label>
          <input
            type="number"
            value={accountBalance}
            onChange={(e) => setAccountBalance(Number(e.target.value))}
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "6px 10px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", width: "120px", outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "11px", color: "#64748b" }}>Auto-Execute GO Signale:</label>
          <button
            onClick={() => setAutoExec((p) => !p)}
            style={{
              width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
              background: autoExec ? "#10c96d" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.15s",
            }}
          >
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: autoExec ? "23px" : "3px", transition: "left 0.15s" }} />
          </button>
          <span style={{ fontSize: "11px", color: autoExec ? "#10c96d" : "#64748b" }}>{autoExec ? "AN" : "AUS"}</span>
        </div>
        {!capitalActive && (
          <div style={{ padding: "6px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "6px", fontSize: "10px", color: "#fbbf24" }}>
            ⚠ Capital.com nicht verbunden — Settings → Broker Connections
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {/* Execution Queue */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.2)", padding: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#a5b4fc", marginBottom: "12px" }}>
            📋 Execution Queue {queue && <span style={{ color: "#64748b", fontWeight: 400 }}>({queue.queuedTrades} trades)</span>}
          </div>
          {!queue?.queue?.length ? (
            <div style={{ fontSize: "11px", color: "#475569", padding: "20px 0", textAlign: "center" }}>Keine GO-Signale in der Queue</div>
          ) : (
            queue.queue.map((item) => (
              <div key={item.id} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "8px", border: `1px solid ${item.direction === "BUY" ? "rgba(16,201,109,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>#{item.rank} {item.symbol}</span>
                    <span style={{ padding: "1px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                      background: item.direction === "BUY" ? "rgba(16,201,109,0.15)" : "rgba(248,113,113,0.15)",
                      color: item.direction === "BUY" ? "#10c96d" : "#f87171",
                      border: `1px solid ${item.direction === "BUY" ? "rgba(16,201,109,0.3)" : "rgba(248,113,113,0.2)"}` }}>
                      {item.direction}
                    </span>
                  </div>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>P:{item.priorityScore} C:{item.adaptiveConfidence.toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "8px" }}>{item.strategy} · Risk {item.riskPerTradePercent}%</div>
                {capitalActive && (
                  <button
                    onClick={() => executeOrder(item)}
                    disabled={executing === item.id || !capitalActive}
                    style={{
                      width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid rgba(16,201,109,0.4)",
                      cursor: "pointer", background: "rgba(16,201,109,0.15)", color: "#10c96d",
                      fontSize: "11px", fontFamily: "monospace", fontWeight: 700,
                      opacity: executing === item.id ? 0.6 : 1,
                    }}
                  >
                    {executing === item.id ? "Ausführe..." : "▶ GO — Jetzt ausführen"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Open Positions */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(16,201,109,0.2)", padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#10c96d" }}>
              📈 Offene Positionen ({positions.length})
            </div>
            {positions.length > 0 && (
              <div style={{ fontSize: "13px", fontWeight: 700, color: totalPnL >= 0 ? "#10c96d" : "#f87171" }}>
                P&L: {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}
              </div>
            )}
          </div>
          {!positions.length ? (
            <div style={{ fontSize: "11px", color: "#475569", padding: "20px 0", textAlign: "center" }}>
              {capitalActive ? "Keine offenen Positionen" : "Capital.com nicht verbunden"}
            </div>
          ) : (
            positions.map((pos) => (
              <div key={pos.dealId} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "8px", border: `1px solid ${pos.profitLoss >= 0 ? "rgba(16,201,109,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>{pos.symbol}</span>
                    <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                      background: pos.direction === "BUY" ? "rgba(16,201,109,0.15)" : "rgba(248,113,113,0.15)",
                      color: pos.direction === "BUY" ? "#10c96d" : "#f87171" }}>
                      {pos.direction}
                    </span>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: pos.profitLoss >= 0 ? "#10c96d" : "#f87171" }}>
                    {pos.profitLoss >= 0 ? "+" : ""}{pos.profitLoss.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "8px" }}>
                  Size: {pos.size} · Entry: {pos.openLevel} · {new Date(pos.createdDate).toLocaleTimeString()}
                </div>
                <button
                  onClick={() => closePosition(pos.dealId)}
                  style={{ padding: "5px 12px", borderRadius: "5px", border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer", background: "rgba(248,113,113,0.1)", color: "#f87171", fontSize: "10px", fontFamily: "monospace" }}>
                  ✕ Schliessen
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Execution Log */}
      {execLogs.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", marginBottom: "10px" }}>📜 Execution Log</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {execLogs.map((log) => (
              <div key={log.id} style={{ display: "flex", gap: "12px", fontSize: "11px", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <span style={{ color: "#475569", minWidth: "60px" }}>{log.ts}</span>
                <span style={{ color: log.ok ? "#10c96d" : "#f87171", minWidth: "14px" }}>{log.ok ? "✓" : "✗"}</span>
                <span style={{ color: "#f1f5f9", fontWeight: 700, minWidth: "70px" }}>{log.symbol}</span>
                <span style={{ color: log.direction === "BUY" ? "#10c96d" : "#f87171", minWidth: "40px" }}>{log.direction}</span>
                <span style={{ color: "#94a3b8", minWidth: "80px" }}>size: {log.size}</span>
                <span style={{ color: "#64748b", minWidth: "130px" }}>{log.broker}</span>
                {log.dealId && <span style={{ color: "#475569" }}>ID: {log.dealId}</span>}
                {log.error && <span style={{ color: "#f87171" }}>{log.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety notice */}
      <div style={{ marginTop: "16px", padding: "10px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", fontSize: "10px", color: "#78716c" }}>
        🔒 <strong>Safety Locks aktiv:</strong> liveTradingEnabled = false · Alle Orders gehen auf Capital.com DEMO-Account · Kein echtes Geld · orderExecutionEnabled = false für LIVE
      </div>
    </div>
  );
}
