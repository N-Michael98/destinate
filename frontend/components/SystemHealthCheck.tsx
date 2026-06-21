"use client";
import { useState } from "react";

type CheckStatus = "PENDING" | "OK" | "ERROR" | "WARN";

interface CheckResult {
  id: string;
  label: string;
  group: string;
  status: CheckStatus;
  message: string;
  responseMs: number;
}

const CHECK_ENDPOINTS: { id: string; label: string; group: string; url: string }[] = [
  // Core System
  { id: "settings", label: "Settings Store", group: "Core", url: "/api/settings" },
  { id: "ai-config", label: "AI Config Store", group: "Core", url: "/api/ai-config" },
  { id: "technical", label: "Technical Indicators", group: "Core", url: "/api/technical-analysis" },
  // Security
  { id: "security", label: "Security Center", group: "Security", url: "/api/security-center" },
  { id: "killswitch", label: "Kill Switch", group: "Security", url: "/api/security-center/killswitch" },
  { id: "malwarebytes", label: "Malwarebytes", group: "Security", url: "/api/security-center/malwarebytes" },
  { id: "telegram", label: "Telegram", group: "Security", url: "/api/security-center/telegram" },
  // AI Engines
  { id: "gpt", label: "GPT Analyst", group: "AI Engines", url: "/api/gpt-analyst/status" },
  { id: "claude", label: "Claude Risk", group: "AI Engines", url: "/api/claude-risk/status" },
  { id: "consensus", label: "Consensus Decision", group: "AI Engines", url: "/api/consensus/decision" },
  { id: "evolution", label: "Autonomous Evolution", group: "AI Engines", url: "/api/autonomous-trading-evolution" },
  // Market Data
  { id: "capital-com", label: "Capital.com Session", group: "Market", url: "/api/capital-com?action=status" },
  { id: "market-data", label: "Market Data", group: "Market", url: "/api/market-data/status" },
  { id: "market-regime", label: "Market Regime", group: "Market", url: "/api/market-regime/status" },
  { id: "news", label: "News Intelligence", group: "Market", url: "/api/news-intelligence" },
  { id: "opportunity", label: "Opportunity Scanner", group: "Market", url: "/api/opportunity-scanner" },
  // Execution Pipeline
  { id: "eq-pos-sync", label: "EQ Position Sync (V16.3.0)", group: "Execution", url: "/api/execution/status" },
  { id: "ticket-sync", label: "Ticket Sync (V16.3.1)", group: "Execution", url: "/api/execution/status" },
  { id: "paper-order", label: "Paper Order Sync (V16.3.2)", group: "Execution", url: "/api/execution/status" },
  { id: "forward-testing", label: "Forward Testing (V16.4.0)", group: "Execution", url: "/api/execution/status" },
  // Portfolio
  { id: "portfolio-brain", label: "Portfolio Brain", group: "Portfolio", url: "/api/portfolio-brain" },
  { id: "position-sizing", label: "Position Sizing", group: "Portfolio", url: "/api/portfolio-brain" },
  { id: "portfolio-intel", label: "Portfolio Intelligence", group: "Portfolio", url: "/api/portfolio-intelligence" },
  // Learning Loop
  { id: "learning", label: "Learning Feedback", group: "Learning", url: "/api/learning/status" },
  { id: "strategy-evo", label: "Strategy Evolution", group: "Learning", url: "/api/learning/status" },
  { id: "outcome", label: "Outcome Learning", group: "Learning", url: "/api/learning/status" },
];

const GROUP_ORDER = ["Core", "Security", "AI Engines", "Market", "Execution", "Portfolio", "Learning"];
const GROUP_COLORS: Record<string, string> = {
  Core: "#6366f1",
  Security: "#f87171",
  "AI Engines": "#00c3ff",
  Market: "#fbbf24",
  Execution: "#10c96d",
  Portfolio: "#a78bfa",
  Learning: "#fb923c",
};

function statusIcon(s: CheckStatus) {
  if (s === "OK") return "✓";
  if (s === "ERROR") return "✗";
  if (s === "WARN") return "⚠";
  return "·";
}
function statusColor(s: CheckStatus) {
  if (s === "OK") return "#10c96d";
  if (s === "ERROR") return "#f87171";
  if (s === "WARN") return "#fbbf24";
  return "#64748b";
}

export default function SystemHealthCheck() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  const runChecks = async () => {
    setRunning(true);
    setDone(false);
    setResults([]);
    setProgress(0);

    const newResults: CheckResult[] = [];

    for (let i = 0; i < CHECK_ENDPOINTS.length; i++) {
      const ep = CHECK_ENDPOINTS[i];
      const start = performance.now();
      let status: CheckStatus = "PENDING";
      let message = "";
      let responseMs = 0;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);
        const r = await fetch(ep.url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timeout);
        responseMs = Math.round(performance.now() - start);

        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          if (data.ok === false) {
            status = "WARN";
            message = data.error ?? "Route ok but returned ok:false";
          } else {
            status = "OK";
            message = `HTTP ${r.status} · ${responseMs}ms`;
          }
        } else {
          status = "ERROR";
          message = `HTTP ${r.status} ${r.statusText}`;
        }
      } catch (err) {
        responseMs = Math.round(performance.now() - start);
        status = "ERROR";
        message = err instanceof Error && err.name === "AbortError" ? "Timeout (>8s)" : err instanceof Error ? err.message : "Network error";
      }

      const result: CheckResult = { ...ep, status, message, responseMs };
      newResults.push(result);
      setResults([...newResults]);
      setProgress(Math.round(((i + 1) / CHECK_ENDPOINTS.length) * 100));

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setRunning(false);
    setDone(true);
  };

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: results.filter((r) => r.group === group),
    pending: CHECK_ENDPOINTS.filter((e) => e.group === group).length,
  }));

  const okCount = results.filter((r) => r.status === "OK").length;
  const errorCount = results.filter((r) => r.status === "ERROR").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;

  return (
    <div style={{ padding: "24px", fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9" }}>🔍 System Kommunikations-Check</span>
            <span style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: "6px", padding: "2px 10px", fontSize: "11px", color: "#a5b4fc" }}>
              V17.2.0
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            Prüft alle {CHECK_ENDPOINTS.length} API-Routen ob sie korrekt antworten
          </div>
        </div>

        <button
          onClick={runChecks}
          disabled={running}
          style={{
            padding: "10px 24px", borderRadius: "8px", border: "1px solid rgba(99,102,241,0.4)", cursor: running ? "not-allowed" : "pointer",
            background: running ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.25)",
            color: running ? "#64748b" : "#a5b4fc",
            fontSize: "13px", fontFamily: "monospace", fontWeight: 700,
          }}
        >
          {running ? `Prüfe... ${progress}%` : done ? "Nochmals prüfen" : "▶ Alle prüfen"}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", marginBottom: "16px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#6366f1", borderRadius: "2px", transition: "width 0.1s" }} />
        </div>
      )}

      {/* Summary */}
      {done && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          {[
            { label: "OK", count: okCount, color: "#10c96d" },
            { label: "WARN", count: warnCount, color: "#fbbf24" },
            { label: "ERROR", count: errorCount, color: "#f87171" },
          ].map((item) => (
            <div key={item.label} style={{
              padding: "10px 20px", borderRadius: "8px",
              background: `${item.color}11`, border: `1px solid ${item.color}33`,
            }}>
              <span style={{ fontSize: "22px", fontWeight: 700, color: item.color }}>{item.count}</span>
              <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>{item.label}</span>
            </div>
          ))}
          <div style={{ padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, color: "#94a3b8" }}>{CHECK_ENDPOINTS.length}</span>
            <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>Total</span>
          </div>
          <div style={{ padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: "22px", fontWeight: 700, color: okCount === CHECK_ENDPOINTS.length ? "#10c96d" : errorCount > 0 ? "#f87171" : "#fbbf24" }}>
              {Math.round((okCount / CHECK_ENDPOINTS.length) * 100)}%
            </span>
            <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>Gesund</span>
          </div>
        </div>
      )}

      {/* Results by group */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {grouped.map(({ group, items, pending }) => {
          const color = GROUP_COLORS[group] ?? "#6366f1";
          const groupOk = items.filter((r) => r.status === "OK").length;
          const groupErr = items.filter((r) => r.status === "ERROR").length;
          return (
            <div key={group} style={{
              background: "rgba(255,255,255,0.03)", borderRadius: "10px",
              border: `1px solid ${color}22`, padding: "14px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color }}>{group}</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  {items.length > 0 && (
                    <>
                      <span style={{ fontSize: "10px", color: "#10c96d" }}>{groupOk} OK</span>
                      {groupErr > 0 && <span style={{ fontSize: "10px", color: "#f87171" }}>{groupErr} ERR</span>}
                    </>
                  )}
                  <span style={{ fontSize: "10px", color: "#475569" }}>{pending} total</span>
                </div>
              </div>
              {CHECK_ENDPOINTS.filter((e) => e.group === group).map((ep) => {
                const result = items.find((r) => r.id === ep.id);
                const status: CheckStatus = result?.status ?? "PENDING";
                return (
                  <div key={ep.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: statusColor(status), minWidth: "14px" }}>
                        {statusIcon(status)}
                      </span>
                      <span style={{ fontSize: "11px", color: result ? "#e2e8f0" : "#475569" }}>{ep.label}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#475569", textAlign: "right", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {result ? result.message : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {!running && !done && (
        <div style={{ padding: "40px", textAlign: "center", color: "#475569", fontSize: "13px" }}>
          Klicke "Alle prüfen" um alle {CHECK_ENDPOINTS.length} API-Verbindungen zu testen.
        </div>
      )}
    </div>
  );
}
