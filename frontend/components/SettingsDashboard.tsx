"use client";
import { useEffect, useState } from "react";
import {
  ALL_BROKER_PROFILES,
  type SystemSettings,
  type BrokerKey,
  type AccountMode,
  type BotMode,
} from "../lib/broker-config";

type Tab =
  | "brokers"
  | "bot-mode"
  | "leverage-spreads"
  | "risk"
  | "system";

interface ConnectionForm {
  apiKey: string;
  accountMode: AccountMode;
  loading: boolean;
  error: string | null;
  success: string | null;
}

const TAB_LIST: { key: Tab; label: string; icon: string }[] = [
  { key: "brokers", label: "Broker Connections", icon: "🔗" },
  { key: "bot-mode", label: "Bot Mode", icon: "🤖" },
  { key: "leverage-spreads", label: "Leverage & Spreads", icon: "📊" },
  { key: "risk", label: "Risk Rules", icon: "🛡️" },
  { key: "system", label: "System", icon: "⚙️" },
];

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("brokers");
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [forms, setForms] = useState<Record<BrokerKey, ConnectionForm>>({
    CAPITAL_COM: { apiKey: "", accountMode: "DEMO", loading: false, error: null, success: null },
    IC_MARKETS: { apiKey: "", accountMode: "DEMO", loading: false, error: null, success: null },
  });

  const fetchSettings = async () => {
    try {
      const r = await fetch("/api/settings");
      const d = await r.json();
      if (d.ok) setSettings(d.settings);
    } catch {
      // silently handle network errors — show empty state
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const postAction = async (payload: Record<string, unknown>) => {
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.settings) setSettings(d.settings);
    setSaving(false);
    return d;
  };

  const handleConnect = async (key: BrokerKey) => {
    const form = forms[key];
    setForms((f) => ({ ...f, [key]: { ...f[key], loading: true, error: null, success: null } }));
    const d = await postAction({
      action: "broker_connect",
      brokerKey: key,
      apiKey: form.apiKey,
      accountMode: form.accountMode,
    });
    setForms((f) => ({
      ...f,
      [key]: {
        ...f[key],
        loading: false,
        error: d.ok ? null : (d.error ?? "Connection failed"),
        success: d.ok ? `Connected — Account ${d.accountId}` : null,
      },
    }));
  };

  const handleDisconnect = async (key: BrokerKey) => {
    await postAction({ action: "broker_disconnect", brokerKey: key });
    setForms((f) => ({ ...f, [key]: { ...f[key], error: null, success: null } }));
  };

  const setBotMode = async (mode: BotMode) => {
    await postAction({ action: "update_bot", patch: { mode } });
  };

  const updateBotField = async (field: string, value: unknown) => {
    await postAction({ action: "update_bot", patch: { [field]: value } });
  };

  const updateRiskField = async (field: string, value: number) => {
    await postAction({ action: "update_risk", patch: { [field]: value } });
  };

  const conn = (key: BrokerKey) =>
    settings?.connections.find((c) => c.brokerKey === key);

  return (
    <div style={{ padding: "24px", fontFamily: "monospace", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <span style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9" }}>⚙️ Settings</span>
          <span style={{
            background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)",
            borderRadius: "6px", padding: "2px 10px", fontSize: "11px", color: "#a5b4fc"
          }}>V17.0.0</span>
        </div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          Broker connections · Bot settings · Leverage & spread data · Risk rules
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", flexWrap: "wrap" }}>
        {TAB_LIST.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
              fontSize: "12px", fontFamily: "monospace", fontWeight: 600,
              background: activeTab === t.key ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
              color: activeTab === t.key ? "#a5b4fc" : "#94a3b8",
              borderBottom: activeTab === t.key ? "2px solid #6366f1" : "2px solid transparent",
              transition: "all 0.15s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ───── BROKER CONNECTIONS ───── */}
      {activeTab === "brokers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {ALL_BROKER_PROFILES.map((profile) => {
            const c = conn(profile.key);
            const f = forms[profile.key];
            return (
              <div
                key={profile.key}
                style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: "12px",
                  border: `1px solid ${c?.connected ? profile.color + "55" : "rgba(255,255,255,0.1)"}`,
                  padding: "20px", overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 700, color: profile.color }}>{profile.name}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                        background: c?.connected ? "rgba(16,201,109,0.15)" : "rgba(239,68,68,0.12)",
                        color: c?.connected ? "#10c96d" : "#f87171",
                        border: `1px solid ${c?.connected ? "rgba(16,201,109,0.3)" : "rgba(239,68,68,0.2)"}`,
                      }}>
                        {c?.connected ? "● CONNECTED" : "○ DISCONNECTED"}
                      </span>
                      {c?.connected && (
                        <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px",
                          background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }}>
                          {c.accountMode}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      {profile.regulation} · {profile.accountType} · {profile.commission}
                    </div>
                  </div>
                </div>

                {c?.connected && c.accountId && (
                  <div style={{
                    background: "rgba(16,201,109,0.06)", border: "1px solid rgba(16,201,109,0.2)",
                    borderRadius: "8px", padding: "10px 14px", marginBottom: "14px",
                    fontSize: "11px", color: "#6ee7b7",
                  }}>
                    Account ID: <strong>{c.accountId}</strong>
                    {c.lastConnectedAt && (
                      <span style={{ marginLeft: "16px", color: "#64748b" }}>
                        Connected: {new Date(c.lastConnectedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {!c?.connected && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>
                        API KEY / PASSWORD
                      </label>
                      <input
                        type="password"
                        placeholder="Enter API key or password..."
                        value={f.apiKey}
                        onChange={(e) =>
                          setForms((prev) => ({
                            ...prev,
                            [profile.key]: { ...prev[profile.key], apiKey: e.target.value },
                          }))
                        }
                        style={{
                          width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9",
                          fontSize: "12px", fontFamily: "monospace", outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ minWidth: "120px" }}>
                      <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>
                        ACCOUNT MODE
                      </label>
                      <select
                        value={f.accountMode}
                        onChange={(e) =>
                          setForms((prev) => ({
                            ...prev,
                            [profile.key]: { ...prev[profile.key], accountMode: e.target.value as AccountMode },
                          }))
                        }
                        style={{
                          background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9",
                          fontSize: "12px", fontFamily: "monospace", outline: "none",
                          width: "100%",
                        }}
                      >
                        <option value="DEMO">DEMO</option>
                        <option value="LIVE">LIVE</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button
                        onClick={() => handleConnect(profile.key)}
                        disabled={f.loading}
                        style={{
                          padding: "8px 20px", borderRadius: "6px", border: `1px solid ${profile.color}55`, cursor: "pointer",
                          background: profile.color + "33", color: profile.color, fontSize: "12px",
                          fontFamily: "monospace", fontWeight: 700,
                          opacity: f.loading ? 0.6 : 1,
                        }}
                      >
                        {f.loading ? "Connecting..." : "Connect"}
                      </button>
                    </div>
                  </div>
                )}

                {c?.connected && (
                  <button
                    onClick={() => handleDisconnect(profile.key)}
                    style={{
                      padding: "7px 16px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.3)",
                      cursor: "pointer", background: "rgba(239,68,68,0.1)", color: "#f87171",
                      fontSize: "11px", fontFamily: "monospace",
                    }}
                  >
                    Disconnect
                  </button>
                )}

                {f.error && (
                  <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", fontSize: "11px", color: "#f87171" }}>
                    ✗ {f.error}
                  </div>
                )}
                {f.success && (
                  <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(16,201,109,0.1)",
                    border: "1px solid rgba(16,201,109,0.3)", borderRadius: "6px", fontSize: "11px", color: "#10c96d" }}>
                    ✓ {f.success}
                  </div>
                )}

                <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.2)", borderRadius: "6px", fontSize: "10px", color: "#78716c" }}>
                  ⚠ Simulation Mode — no real broker connection is made. All orders remain paper trades.
                  Live trading requires explicit system unlock.
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───── BOT MODE ───── */}
      {activeTab === "bot-mode" && settings && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.1)", padding: "24px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "20px" }}>
              Trading Bot Mode
            </div>

            <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
              {(["MANUAL", "AUTO"] as BotMode[]).map((mode) => {
                const active = settings.botSettings.mode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setBotMode(mode)}
                    style={{
                      flex: 1, padding: "20px", borderRadius: "10px", cursor: "pointer",
                      background: active
                        ? (mode === "MANUAL" ? "rgba(99,102,241,0.2)" : "rgba(16,201,109,0.15)")
                        : "rgba(255,255,255,0.04)",
                      border: active
                        ? `2px solid ${mode === "MANUAL" ? "#6366f1" : "#10c96d"}`
                        : "2px solid rgba(255,255,255,0.08)",
                      color: active ? (mode === "MANUAL" ? "#a5b4fc" : "#10c96d") : "#64748b",
                      fontFamily: "monospace",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                      {mode === "MANUAL" ? "🖐" : "🤖"}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{mode}</div>
                    <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.7 }}>
                      {mode === "MANUAL"
                        ? "All signals require manual approval"
                        : "Bot auto-executes above confidence threshold"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { label: "Max Trades / Day", field: "maxTradesPerDay", value: settings.botSettings.maxTradesPerDay, min: 1, max: 20 },
                { label: "Max Concurrent Positions", field: "maxConcurrentPositions", value: settings.botSettings.maxConcurrentPositions, min: 1, max: 10 },
                { label: "Auto-Approve Threshold (%)", field: "autoApproveThreshold", value: settings.botSettings.autoApproveThreshold, min: 50, max: 99 },
                { label: "Pause on Loss (%)", field: "pauseOnLossPercent", value: settings.botSettings.pauseOnLossPercent, min: 0.5, max: 20 },
              ].map((item) => (
                <div key={item.field} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "14px" }}>
                  <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>
                    {item.label}
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="range"
                      min={item.min}
                      max={item.max}
                      step={item.field === "pauseOnLossPercent" ? 0.5 : 1}
                      value={item.value}
                      onChange={(e) => updateBotField(item.field, parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: "#6366f1" }}
                    />
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", minWidth: "40px", textAlign: "right" }}>
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px",
              background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "14px" }}>
              <label style={{ fontSize: "10px", color: "#64748b", flex: 1, textTransform: "uppercase" }}>
                Pause On Drawdown
              </label>
              <button
                onClick={() => updateBotField("pauseOnLoss", !settings.botSettings.pauseOnLoss)}
                style={{
                  width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                  background: settings.botSettings.pauseOnLoss ? "#10c96d" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: "18px", height: "18px", borderRadius: "50%", background: "#fff",
                  position: "absolute", top: "3px",
                  left: settings.botSettings.pauseOnLoss ? "23px" : "3px",
                  transition: "left 0.15s",
                }} />
              </button>
              <span style={{ fontSize: "12px", color: settings.botSettings.pauseOnLoss ? "#10c96d" : "#64748b" }}>
                {settings.botSettings.pauseOnLoss ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ───── LEVERAGE & SPREADS ───── */}
      {activeTab === "leverage-spreads" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {ALL_BROKER_PROFILES.map((profile) => (
            <div key={profile.key} style={{
              background: "rgba(255,255,255,0.04)", borderRadius: "12px",
              border: `1px solid ${profile.color}33`, padding: "20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: profile.color }}>{profile.name}</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>— {profile.accountType} · {profile.commission}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      {["Symbol", "Leverage", "Margin %", "Typical Spread", "Spread Unit", "Commission/Lot", "Notes"].map((h) => (
                        <th key={h} style={{
                          padding: "8px 12px", textAlign: "left", color: "#64748b",
                          fontSize: "10px", textTransform: "uppercase", fontWeight: 600,
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.symbols.map((sym, i) => (
                      <tr key={sym.symbol} style={{
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f1f5f9" }}>
                          {sym.symbol}
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 400 }}>{sym.symbolLabel}</div>
                        </td>
                        <td style={{ padding: "10px 12px", color: profile.color, fontWeight: 700 }}>
                          {sym.leverageLabel}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{sym.marginPercent}%</td>
                        <td style={{ padding: "10px 12px", color: "#f1f5f9", fontWeight: 600 }}>{sym.spreadTypical}</td>
                        <td style={{ padding: "10px 12px", color: "#64748b" }}>{sym.spreadUnit}</td>
                        <td style={{ padding: "10px 12px", color: sym.commissionPerLot > 0 ? "#fbbf24" : "#64748b" }}>
                          {sym.commissionPerLot > 0 ? `$${sym.commissionPerLot}` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#64748b", fontSize: "10px", maxWidth: "200px" }}>
                          {sym.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "8px", padding: "14px", fontSize: "11px", color: "#78716c" }}>
            ℹ These are reference values sourced from broker documentation. Actual spreads are variable and depend
            on market conditions and account tier. Commission figures are for Raw Spread / ECN accounts.
            Forward Testing uses these values for spread-adjusted PnL calculations.
          </div>
        </div>
      )}

      {/* ───── RISK RULES ───── */}
      {activeTab === "risk" && settings && (
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.1)", padding: "24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "20px" }}>
            Risk Management Rules
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              { label: "Max Risk Per Trade (%)", field: "maxRiskPerTradePct", value: settings.riskSettings.maxRiskPerTradePct, min: 0.1, max: 5, step: 0.1, color: "#10c96d" },
              { label: "Max Daily Drawdown (%)", field: "maxDailyDrawdownPct", value: settings.riskSettings.maxDailyDrawdownPct, min: 0.5, max: 10, step: 0.5, color: "#fbbf24" },
              { label: "Max Total Drawdown (%)", field: "maxTotalDrawdownPct", value: settings.riskSettings.maxTotalDrawdownPct, min: 1, max: 30, step: 1, color: "#f87171" },
              { label: "Max Portfolio Exposure (%)", field: "maxExposurePct", value: settings.riskSettings.maxExposurePct, min: 5, max: 100, step: 5, color: "#a5b4fc" },
              { label: "Min Signal Confidence (%)", field: "minConfidenceScore", value: settings.riskSettings.minConfidenceScore, min: 30, max: 99, step: 1, color: "#00c3ff" },
            ].map((item) => (
              <div key={item.field} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "16px" }}>
                <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>
                  {item.label}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="range"
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={item.value}
                    onChange={(e) => updateRiskField(item.field, parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: item.color }}
                  />
                  <span style={{ fontSize: "16px", fontWeight: 700, color: item.color, minWidth: "50px", textAlign: "right" }}>
                    {item.value}%
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#475569", marginTop: "4px" }}>
                  <span>{item.min}%</span>
                  <span>{item.max}%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "11px", color: "#78716c" }}>
            ⚠ Risk rules are enforced by the Position Sizing Engine and Forward Testing Engine.
            Lowering these values increases capital protection but reduces position size and potential returns.
          </div>
        </div>
      )}

      {/* ───── SYSTEM ───── */}
      {activeTab === "system" && settings && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.1)", padding: "24px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "16px" }}>System Information</div>
            {[
              { label: "Version", value: settings.version },
              { label: "Bot Mode", value: settings.botSettings.mode },
              { label: "Last Settings Update", value: new Date(settings.updatedAt).toLocaleString() },
              { label: "Live Trading", value: "DISABLED — Paper Mode Only" },
              { label: "Order Execution", value: "DISABLED — Simulation Only" },
              { label: "Broker Mode", value: "READ_ONLY — No real orders sent" },
            ].map((row) => (
              <div key={row.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{row.label}</span>
                <span style={{ fontSize: "12px", color: "#f1f5f9", fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: "10px",
            border: "1px solid rgba(239,68,68,0.2)", padding: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#f87171", marginBottom: "8px" }}>
              🔒 Safety Locks — Active
            </div>
            <div style={{ fontSize: "11px", color: "#78716c", lineHeight: 1.7 }}>
              • <code>liveTradingEnabled = false</code> — hardcoded, cannot be toggled via UI<br />
              • <code>orderExecutionEnabled = false</code> — no real broker orders<br />
              • <code>brokerConnectionMode = "READ_ONLY"</code> — all API calls are simulated<br />
              • Kill Switch available in Security Center for emergency shutdown
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div style={{
          position: "fixed", bottom: "20px", right: "20px",
          background: "rgba(99,102,241,0.9)", color: "#fff",
          padding: "10px 16px", borderRadius: "8px", fontSize: "12px", fontFamily: "monospace",
        }}>
          Saving...
        </div>
      )}
    </div>
  );
}
