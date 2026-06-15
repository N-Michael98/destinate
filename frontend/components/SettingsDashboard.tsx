"use client";
import { useEffect, useState } from "react";
import {
  ALL_BROKER_PROFILES,
  type SystemSettings,
  type BrokerKey,
  type AccountMode,
  type BotMode,
} from "../lib/broker-config";
import type { AISettings } from "../lib/ai-config";

type Tab =
  | "brokers"
  | "ai-connections"
  | "bot-mode"
  | "leverage-spreads"
  | "risk"
  | "system";

interface ConnectionForm {
  apiKey: string;
  login: string;
  password: string;
  accountMode: AccountMode;
  loading: boolean;
  error: string | null;
  success: string | null;
}

interface CapitalAccountInfo {
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  balance: number;
  deposit: number;
  profitLoss: number;
  available: number;
}

const TAB_LIST: { key: Tab; label: string; icon: string }[] = [
  { key: "brokers", label: "Broker Connections", icon: "🔗" },
  { key: "ai-connections", label: "AI & Telegram", icon: "🤖" },
  { key: "bot-mode", label: "Bot Mode", icon: "⚡" },
  { key: "leverage-spreads", label: "Leverage & Spreads", icon: "📊" },
  { key: "risk", label: "Risk Rules", icon: "🛡️" },
  { key: "system", label: "System", icon: "⚙️" },
];

function ChangeUsernameForm() {
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const r = await fetch("/api/auth/change-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newUsername }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    setLoading(false);
    setResult({ ok: d?.ok ?? false, msg: d?.ok ? `Benutzername geändert zu "${d.username}"` : (d?.error ?? "Fehler") });
    if (d?.ok) setNewUsername("");
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", padding: "24px" }}>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "16px" }}>👤 Benutzername ändern</div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>NEUER BENUTZERNAME</label>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Mindestens 3 Zeichen..."
            minLength={3}
            required
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "9px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none" }}
          />
        </div>
        {result && (
          <div style={{ padding: "8px 12px", borderRadius: "6px", fontSize: "11px", background: result.ok ? "rgba(16,201,109,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${result.ok ? "rgba(16,201,109,0.3)" : "rgba(239,68,68,0.3)"}`, color: result.ok ? "#10c96d" : "#f87171" }}>
            {result.ok ? "✓" : "✗"} {result.msg}
          </div>
        )}
        <div>
          <button type="submit" disabled={loading || newUsername.length < 3}
            style={{ padding: "9px 24px", borderRadius: "6px", border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", fontSize: "12px", fontFamily: "monospace", fontWeight: 700, cursor: "pointer", opacity: (loading || newUsername.length < 3) ? 0.5 : 1 }}>
            {loading ? "Speichern..." : "Benutzername speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const set = (k: "current" | "next" | "confirm") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next !== form.confirm) {
      setResult({ ok: false, msg: "Neue Passwörter stimmen nicht überein" });
      return;
    }
    setLoading(true);
    setResult(null);
    const r = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    setLoading(false);
    setResult({ ok: d?.ok ?? false, msg: d?.message ?? d?.error ?? "Fehler" });
    if (d?.ok) setForm({ current: "", next: "", confirm: "" });
  };

  const inp = (val: string, onChange: React.ChangeEventHandler<HTMLInputElement>, placeholder: string) => (
    <input
      type="password"
      value={val}
      onChange={onChange}
      placeholder={placeholder}
      required
      style={{
        width: "100%", boxSizing: "border-box",
        background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "6px", padding: "9px 12px", color: "#f1f5f9",
        fontSize: "12px", fontFamily: "monospace", outline: "none",
      }}
    />
  );

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", padding: "24px" }}>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "16px" }}>🔑 Passwort ändern</div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>AKTUELLES PASSWORT</label>
          {inp(form.current, set("current"), "Aktuelles Passwort...")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>NEUES PASSWORT</label>
            {inp(form.next, set("next"), "Mindestens 8 Zeichen...")}
          </div>
          <div>
            <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>WIEDERHOLEN</label>
            {inp(form.confirm, set("confirm"), "Passwort bestätigen...")}
          </div>
        </div>
        {result && (
          <div style={{
            padding: "8px 12px", borderRadius: "6px", fontSize: "11px",
            background: result.ok ? "rgba(16,201,109,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${result.ok ? "rgba(16,201,109,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: result.ok ? "#10c96d" : "#f87171",
          }}>
            {result.ok ? "✓" : "✗"} {result.msg}
          </div>
        )}
        <div>
          <button
            type="submit"
            disabled={loading || !form.current || !form.next || !form.confirm}
            style={{
              padding: "9px 24px", borderRadius: "6px", border: "1px solid rgba(99,102,241,0.4)",
              background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
              fontSize: "12px", fontFamily: "monospace", fontWeight: 700, cursor: "pointer",
              opacity: (loading || !form.current || !form.next || !form.confirm) ? 0.5 : 1,
            }}
          >
            {loading ? "Speichern..." : "Passwort speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("brokers");
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [forms, setForms] = useState<Record<BrokerKey, ConnectionForm>>({
    CAPITAL_COM: { apiKey: "", login: "", password: "", accountMode: "DEMO", loading: false, error: null, success: null },
    IC_MARKETS: { apiKey: "", login: "", password: "", accountMode: "DEMO", loading: false, error: null, success: null },
  });
  const [capitalAccounts, setCapitalAccounts] = useState<CapitalAccountInfo[]>([]);
  const [diagResult, setDiagResult] = useState<{ ok: boolean; steps: { step: string; ok: boolean; detail: string }[]; error?: string | null; hint?: string } | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4-6");
  const [tgToken, setTgToken] = useState("");
  const [tgChannels, setTgChannels] = useState({
    TRADES: { chatId: "", enabled: false },
    SECURITY: { chatId: "", enabled: false },
    AI_ANALYSIS: { chatId: "", enabled: false },
    SYSTEM_HEALTH: { chatId: "", enabled: false },
  });
  const [aiTestResult, setAITestResult] = useState<Record<string, { ok: boolean; msg: string } | null>>({});

  const fetchSettings = async () => {
    try {
      const [sR, aiR, capR] = await Promise.all([
        fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
        fetch("/api/ai-config").then((r) => r.json()).catch(() => ({})),
        fetch("/api/capital-com").then((r) => r.json()).catch(() => ({})),
      ]);
      if (sR.ok) setSettings(sR.settings);
      // Pre-fill Capital.com login field if credentials are saved
      if (capR?.savedIdentifier) {
        setForms((p) => ({ ...p, CAPITAL_COM: { ...p.CAPITAL_COM, login: capR.savedIdentifier } }));
      }
      // Show reconnect error if auto-reconnect failed (or no credentials saved)
      if (!capR?.connected) {
        if (capR?.reconnectError) {
          setCapitalError(`Auto-Reconnect Fehler: ${capR.reconnectError}`);
        } else if (capR?.hasSavedCredentials === false) {
          setCapitalError("Keine Credentials in DB gespeichert — bitte manuell verbinden (API Key + Login + Passwort eingeben und Connect klicken)");
        } else if (Object.keys(capR ?? {}).length === 0) {
          setCapitalError("Capital.com API nicht erreichbar — bitte manuell verbinden");
        }
      } else {
        setCapitalError(null);
      }
      if (aiR.ok) {
        setAISettings(aiR.settings);
        if (aiR.settings?.openai) {
          setOpenaiModel(aiR.settings.openai.model);
          if (aiR.settings.openai.apiKey) setOpenaiKey(aiR.settings.openai.apiKey);
        }
        if (aiR.settings?.anthropic) {
          setAnthropicModel(aiR.settings.anthropic.model);
          if (aiR.settings.anthropic.apiKey) setAnthropicKey(aiR.settings.anthropic.apiKey);
        }
        if (aiR.settings?.telegram) {
          setTgChannels(aiR.settings.telegram.channels);
        }
      }
    } catch {
      // silently handle network errors
    }
  };

  useEffect(() => {
    fetchSettings();
    // Auto-refresh every 20s when Capital.com not yet connected (catches auto-reconnect completing)
    const iv = setInterval(() => { fetchSettings(); }, 20000);
    return () => clearInterval(iv);
  }, []);

  const postAI = async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!r) return null;
    const d = await r.json().catch(() => null);
    if (d?.settings) setAISettings(d.settings);
    return d;
  };

  const [aiTesting, setAITesting] = useState<Record<string, boolean>>({});

  const saveOpenAIKey = async () => {
    const d = await postAI({ action: "save_openai_key", apiKey: openaiKey, model: openaiModel });
    setAITestResult((prev) => ({ ...prev, openai: { ok: d?.ok ?? false, msg: d?.ok ? "Key gespeichert ✓ — klicke Test um zu verifizieren" : "Fehler beim Speichern" } }));
  };

  const testOpenAI = async () => {
    setAITesting((p) => ({ ...p, openai: true }));
    setAITestResult((prev) => ({ ...prev, openai: null }));
    const d = await postAI({ action: "test_openai", apiKey: openaiKey, model: openaiModel });
    setAITestResult((prev) => ({ ...prev, openai: { ok: d?.ok ?? false, msg: d?.error ?? (d?.ok ? "✓ Verbunden — Key ist gültig" : "Fehler") } }));
    setAITesting((p) => ({ ...p, openai: false }));
  };

  const saveAnthropicKey = async () => {
    const d = await postAI({ action: "save_anthropic_key", apiKey: anthropicKey, model: anthropicModel });
    setAITestResult((prev) => ({ ...prev, anthropic: { ok: d?.ok ?? false, msg: d?.ok ? "Key gespeichert ✓ — klicke Test um zu verifizieren" : "Fehler beim Speichern" } }));
  };

  const testAnthropic = async () => {
    setAITesting((p) => ({ ...p, anthropic: true }));
    setAITestResult((prev) => ({ ...prev, anthropic: null }));
    const d = await postAI({ action: "test_anthropic", apiKey: anthropicKey, model: anthropicModel });
    setAITestResult((prev) => ({ ...prev, anthropic: { ok: d?.ok ?? false, msg: d?.error ?? (d?.ok ? "✓ Verbunden — Key ist gültig" : "Fehler") } }));
    setAITesting((p) => ({ ...p, anthropic: false }));
  };

  const saveTelegram = async () => {
    await postAI({ action: "save_telegram", botToken: tgToken, channels: tgChannels });
    setAITestResult((prev) => ({ ...prev, telegram: { ok: true, msg: "Gespeichert ✓" } }));
  };

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

    if (key === "CAPITAL_COM") {
      // Real Capital.com DEMO API connection
      const r = await fetch("/api/capital-com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", apiKey: form.apiKey, login: form.login, password: form.password }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => ({ ok: false, error: "Parse error" })) : { ok: false, error: "Network error" };

      if (d.ok) {
        setCapitalAccounts(d.accounts ?? []);
        // Sync to settings store for status display
        await postAction({ action: "broker_connect", brokerKey: key, apiKey: form.apiKey, accountMode: "DEMO" });
        const balance = d.accounts?.[0]?.balance;
        const balanceStr = balance != null ? ` · Balance: ${d.accounts[0].currency} ${balance.toFixed(2)}` : "";
        setForms((f) => ({ ...f, [key]: { ...f[key], loading: false, error: null, success: `Connected ✓ — ${d.accountId}${balanceStr}` } }));
      } else {
        setForms((f) => ({ ...f, [key]: { ...f[key], loading: false, error: d.error ?? "Connection failed", success: null } }));
      }
    } else {
      // IC Markets — simulation
      const d = await postAction({ action: "broker_connect", brokerKey: key, apiKey: form.apiKey, accountMode: form.accountMode });
      setForms((f) => ({
        ...f,
        [key]: { ...f[key], loading: false, error: d.ok ? null : (d.error ?? "Connection failed"), success: d.ok ? `Connected — Account ${d.accountId}` : null },
      }));
    }
  };

  const runDiagnose = async () => {
    const f = forms["CAPITAL_COM"];
    setDiagLoading(true);
    setDiagResult(null);
    const r = await fetch("/api/capital-com/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: f.apiKey, identifier: f.login, password: f.password }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    setDiagResult(d ?? { ok: false, steps: [], error: "Diagnose-Endpoint nicht erreichbar" });
    setDiagLoading(false);
  };

  const handleDisconnect = async (key: BrokerKey) => {
    if (key === "CAPITAL_COM") {
      await fetch("/api/capital-com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      }).catch(() => {});
      setCapitalAccounts([]);
    }
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

                {!c?.connected && profile.key === "CAPITAL_COM" && (
                  <div style={{ marginBottom: "12px", padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", fontSize: "11px", color: "#f87171" }}>
                    ⚠ {capitalError ?? "Capital.com nicht verbunden — bitte Credentials eingeben und Connect klicken"}
                  </div>
                )}

                {c?.connected && c.accountId && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ background: "rgba(16,201,109,0.06)", border: "1px solid rgba(16,201,109,0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "11px", color: "#6ee7b7" }}>
                      Account ID: <strong>{c.accountId}</strong>
                      {c.lastConnectedAt && (
                        <span style={{ marginLeft: "16px", color: "#64748b" }}>
                          Connected: {new Date(c.lastConnectedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {profile.key === "CAPITAL_COM" && capitalAccounts.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", marginTop: "8px" }}>
                        {capitalAccounts.map((acc) => (
                          <div key={acc.accountId} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px", border: "1px solid rgba(16,201,109,0.15)" }}>
                            <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "4px" }}>{acc.accountName} · {acc.accountType}</div>
                            <div style={{ fontSize: "16px", fontWeight: 700, color: "#10c96d" }}>{acc.currency} {(acc.balance ?? 0).toFixed(2)}</div>
                            <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                              Available: {(acc.available ?? 0).toFixed(2)} · P&L: <span style={{ color: (acc.profitLoss ?? 0) >= 0 ? "#10c96d" : "#f87171" }}>{(acc.profitLoss ?? 0).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!c?.connected && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {profile.key === "CAPITAL_COM" ? (
                      // Capital.com: real API — needs API Key + Email + Password
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                          <div>
                            <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>API KEY (X-CAP-API-KEY)</label>
                            <input
                              type="password"
                              placeholder="Dein Capital.com API Key..."
                              value={f.apiKey}
                              onChange={(e) => setForms((p) => ({ ...p, CAPITAL_COM: { ...p.CAPITAL_COM, apiKey: e.target.value } }))}
                              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>LOGIN E-MAIL</label>
                            <input
                              type="email"
                              placeholder="deine@email.com"
                              value={f.login}
                              onChange={(e) => setForms((p) => ({ ...p, CAPITAL_COM: { ...p.CAPITAL_COM, login: e.target.value } }))}
                              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>PASSWORT</label>
                            <input
                              type="password"
                              placeholder="Capital.com Passwort..."
                              value={f.password}
                              onChange={(e) => setForms((p) => ({ ...p, CAPITAL_COM: { ...p.CAPITAL_COM, password: e.target.value } }))}
                              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: "4px", fontSize: "10px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
                            DEMO API
                          </span>
                          <span style={{ fontSize: "10px", color: "#475569" }}>
                            Verbindet mit demo-api-capital.backend.capital — READ ONLY, kein Trading
                          </span>
                          <button
                            onClick={runDiagnose}
                            disabled={diagLoading || !f.apiKey || !f.login || !f.password}
                            style={{
                              marginLeft: "auto", padding: "8px 16px", borderRadius: "6px",
                              border: "1px solid rgba(245,158,11,0.4)", cursor: "pointer",
                              background: "rgba(245,158,11,0.1)", color: "#fbbf24", fontSize: "12px",
                              fontFamily: "monospace", fontWeight: 700,
                              opacity: (diagLoading || !f.apiKey || !f.login || !f.password) ? 0.5 : 1,
                            }}
                          >
                            {diagLoading ? "Prüfe..." : "🔍 Diagnose"}
                          </button>
                          <button
                            onClick={() => handleConnect(profile.key)}
                            disabled={f.loading || !f.apiKey || !f.login || !f.password}
                            style={{
                              padding: "8px 24px", borderRadius: "6px", border: `1px solid ${profile.color}55`, cursor: "pointer",
                              background: profile.color + "33", color: profile.color, fontSize: "12px",
                              fontFamily: "monospace", fontWeight: 700,
                              opacity: (f.loading || !f.apiKey || !f.login || !f.password) ? 0.5 : 1,
                            }}
                          >
                            {f.loading ? "Verbinde..." : "▶ Connect"}
                          </button>
                        </div>
                      </>
                    ) : (
                      // IC Markets — simulation
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>API KEY</label>
                          <input
                            type="password"
                            placeholder="Enter API key..."
                            value={f.apiKey}
                            onChange={(e) => setForms((p) => ({ ...p, [profile.key]: { ...p[profile.key], apiKey: e.target.value } }))}
                            style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                          />
                        </div>
                        <div style={{ minWidth: "120px" }}>
                          <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>ACCOUNT MODE</label>
                          <select
                            value={f.accountMode}
                            onChange={(e) => setForms((p) => ({ ...p, [profile.key]: { ...p[profile.key], accountMode: e.target.value as AccountMode } }))}
                            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", width: "100%" }}
                          >
                            <option value="DEMO">DEMO</option>
                            <option value="LIVE">LIVE</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end" }}>
                          <button
                            onClick={() => handleConnect(profile.key)}
                            disabled={f.loading}
                            style={{ padding: "8px 20px", borderRadius: "6px", border: `1px solid ${profile.color}55`, cursor: "pointer", background: profile.color + "33", color: profile.color, fontSize: "12px", fontFamily: "monospace", fontWeight: 700, opacity: f.loading ? 0.6 : 1 }}
                          >
                            {f.loading ? "Connecting..." : "Connect"}
                          </button>
                        </div>
                      </div>
                    )}
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

                {profile.key === "CAPITAL_COM" && diagResult && (
                  <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24", marginBottom: "8px" }}>🔍 Diagnose-Ergebnis</div>
                    {diagResult.steps.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", fontSize: "11px" }}>
                        <span style={{ color: s.ok ? "#10c96d" : "#f87171" }}>{s.ok ? "✓" : "✗"}</span>
                        <span style={{ color: "#94a3b8", flex: 1 }}>{s.step}</span>
                        <span style={{ color: s.ok ? "#6ee7b7" : "#fca5a5", fontFamily: "monospace" }}>{s.detail}</span>
                      </div>
                    ))}
                    {diagResult.error && (
                      <div style={{ marginTop: "8px", padding: "6px 10px", background: "rgba(239,68,68,0.1)", borderRadius: "6px", fontSize: "11px", color: "#f87171" }}>
                        {diagResult.error}
                      </div>
                    )}
                    {diagResult.hint && (
                      <div style={{ marginTop: "6px", padding: "6px 10px", background: "rgba(245,158,11,0.08)", borderRadius: "6px", fontSize: "11px", color: "#fbbf24" }}>
                        💡 {diagResult.hint}
                      </div>
                    )}
                    {diagResult.ok && (
                      <div style={{ marginTop: "8px", padding: "6px 10px", background: "rgba(16,201,109,0.08)", borderRadius: "6px", fontSize: "11px", color: "#10c96d" }}>
                        ✓ Verbindung erfolgreich — jetzt auf Connect klicken
                      </div>
                    )}
                  </div>
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

                <div style={{ marginTop: "12px", padding: "8px 12px",
                  background: profile.key === "CAPITAL_COM" ? "rgba(99,102,241,0.06)" : "rgba(245,158,11,0.06)",
                  border: `1px solid ${profile.key === "CAPITAL_COM" ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)"}`,
                  borderRadius: "6px", fontSize: "10px", color: "#78716c" }}>
                  {profile.key === "CAPITAL_COM"
                    ? "🔗 Echte API-Verbindung (DEMO) — Marktpreise werden live geladen. Kein Trading, nur READ ONLY. Safety Lock aktiv."
                    : "⚠ Simulation Mode — no real broker connection is made. All orders remain paper trades."}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───── AI & TELEGRAM ───── */}
      {activeTab === "ai-connections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Info box */}
          <div style={{ padding: "14px 16px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "10px", fontSize: "11px", color: "#94a3b8", lineHeight: 1.7 }}>
            <strong style={{ color: "#a5b4fc" }}>So verbindest du GPT und Claude:</strong><br />
            1. API Key eingeben → <strong>Speichern</strong> klicken (Key wird sofort im System gespeichert)<br />
            2. <strong>Verbindung testen</strong> klicken — macht einen echten API-Call zur Verifizierung<br />
            3. Grüner Badge = aktiv → Market Scanner nutzt ab sofort echte KI-Analyse
          </div>

          {/* OpenAI */}
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: `1px solid ${aiSettings?.openai.connected ? "rgba(16,201,109,0.4)" : "rgba(16,185,129,0.2)"}`, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "#10b981" }}>① OpenAI / GPT</span>
              {aiSettings?.openai.connected
                ? <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(16,201,109,0.18)", color: "#10c96d", border: "1px solid rgba(16,201,109,0.4)" }}>● VERBUNDEN</span>
                : aiSettings?.openai.testStatus === "FAILED"
                ? <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>✗ FEHLER</span>
                : aiSettings?.openai.testStatus === "UNTESTED" && aiSettings.openai.apiKey
                ? <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>⏳ GESPEICHERT — noch nicht getestet</span>
                : <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", color: "#475569" }}>○ Nicht verbunden</span>
              }
              {aiSettings?.openai.connected && <span style={{ fontSize: "10px", color: "#475569" }}>{aiSettings.openai.model}</span>}
            </div>

            <div style={{ marginBottom: "12px", padding: "10px 14px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "8px", fontSize: "10px", color: "#64748b" }}>
              OpenAI API Key holen: <strong style={{ color: "#10b981" }}>platform.openai.com → API Keys → Create new secret key</strong><br />
              Format: <code style={{ color: "#a5b4fc" }}>sk-proj-...</code> oder <code style={{ color: "#a5b4fc" }}>sk-...</code>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>API KEY</label>
                <input type="password" placeholder="sk-proj-... oder sk-..." value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)}
                  style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>MODEL</label>
                <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace" }}>
                  {["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={saveOpenAIKey} disabled={!openaiKey}
                style={{ padding: "8px 18px", borderRadius: "6px", border: "1px solid rgba(16,185,129,0.4)", cursor: openaiKey ? "pointer" : "not-allowed", background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "12px", fontFamily: "monospace", fontWeight: 700, opacity: openaiKey ? 1 : 0.5 }}>
                💾 Speichern
              </button>
              <button onClick={testOpenAI} disabled={!openaiKey || aiTesting.openai}
                style={{ padding: "8px 18px", borderRadius: "6px", border: "1px solid rgba(16,185,129,0.3)", cursor: (openaiKey && !aiTesting.openai) ? "pointer" : "not-allowed", background: "rgba(16,185,129,0.08)", color: "#6ee7b7", fontSize: "12px", fontFamily: "monospace", opacity: (openaiKey && !aiTesting.openai) ? 1 : 0.5 }}>
                {aiTesting.openai ? "Teste..." : "🔗 Verbindung testen"}
              </button>
            </div>

            {aiTestResult.openai && (
              <div style={{ marginTop: "10px", padding: "10px 14px", borderRadius: "8px", fontSize: "11px",
                background: aiTestResult.openai.ok ? "rgba(16,201,109,0.1)" : "rgba(239,68,68,0.08)",
                color: aiTestResult.openai.ok ? "#10c96d" : "#f87171",
                border: `1px solid ${aiTestResult.openai.ok ? "rgba(16,201,109,0.3)" : "rgba(239,68,68,0.2)"}` }}>
                {aiTestResult.openai.msg}
              </div>
            )}
          </div>

          {/* Anthropic */}
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: `1px solid ${aiSettings?.anthropic.connected ? "rgba(16,201,109,0.4)" : "rgba(168,85,247,0.2)"}`, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "#a855f7" }}>② Anthropic / Claude</span>
              {aiSettings?.anthropic.connected
                ? <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(16,201,109,0.18)", color: "#10c96d", border: "1px solid rgba(16,201,109,0.4)" }}>● VERBUNDEN</span>
                : aiSettings?.anthropic.testStatus === "FAILED"
                ? <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>✗ FEHLER</span>
                : aiSettings?.anthropic.testStatus === "UNTESTED" && aiSettings.anthropic.apiKey
                ? <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>⏳ GESPEICHERT — noch nicht getestet</span>
                : <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", color: "#475569" }}>○ Nicht verbunden</span>
              }
              {aiSettings?.anthropic.connected && <span style={{ fontSize: "10px", color: "#475569" }}>{aiSettings.anthropic.model}</span>}
            </div>

            <div style={{ marginBottom: "12px", padding: "10px 14px", background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: "8px", fontSize: "10px", color: "#64748b" }}>
              Anthropic API Key holen: <strong style={{ color: "#a855f7" }}>console.anthropic.com → API Keys → Create Key</strong><br />
              Format: <code style={{ color: "#a5b4fc" }}>sk-ant-api03-...</code>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>API KEY</label>
                <input type="password" placeholder="sk-ant-api03-..." value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)}
                  style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>MODEL</label>
                <select value={anthropicModel} onChange={(e) => setAnthropicModel(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace" }}>
                  {["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={saveAnthropicKey} disabled={!anthropicKey}
                style={{ padding: "8px 18px", borderRadius: "6px", border: "1px solid rgba(168,85,247,0.4)", cursor: anthropicKey ? "pointer" : "not-allowed", background: "rgba(168,85,247,0.15)", color: "#a855f7", fontSize: "12px", fontFamily: "monospace", fontWeight: 700, opacity: anthropicKey ? 1 : 0.5 }}>
                💾 Speichern
              </button>
              <button onClick={testAnthropic} disabled={!anthropicKey || aiTesting.anthropic}
                style={{ padding: "8px 18px", borderRadius: "6px", border: "1px solid rgba(168,85,247,0.3)", cursor: (anthropicKey && !aiTesting.anthropic) ? "pointer" : "not-allowed", background: "rgba(168,85,247,0.08)", color: "#d8b4fe", fontSize: "12px", fontFamily: "monospace", opacity: (anthropicKey && !aiTesting.anthropic) ? 1 : 0.5 }}>
                {aiTesting.anthropic ? "Teste..." : "🔗 Verbindung testen"}
              </button>
            </div>

            {aiTestResult.anthropic && (
              <div style={{ marginTop: "10px", padding: "10px 14px", borderRadius: "8px", fontSize: "11px",
                background: aiTestResult.anthropic.ok ? "rgba(16,201,109,0.1)" : "rgba(239,68,68,0.08)",
                color: aiTestResult.anthropic.ok ? "#10c96d" : "#f87171",
                border: `1px solid ${aiTestResult.anthropic.ok ? "rgba(16,201,109,0.3)" : "rgba(239,68,68,0.2)"}` }}>
                {aiTestResult.anthropic.msg}
              </div>
            )}
          </div>

          {/* Telegram */}
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: "1px solid rgba(0,195,255,0.2)", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "#00c3ff" }}>③ Telegram Bot</span>
              {aiSettings?.telegram.configured && (
                <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(16,201,109,0.18)", color: "#10c96d", border: "1px solid rgba(16,201,109,0.4)" }}>● KONFIGURIERT</span>
              )}
            </div>
            <div style={{ marginBottom: "12px", padding: "10px 14px", background: "rgba(0,195,255,0.05)", border: "1px solid rgba(0,195,255,0.15)", borderRadius: "8px", fontSize: "10px", color: "#64748b" }}>
              Bot erstellen: <strong style={{ color: "#00c3ff" }}>@BotFather auf Telegram → /newbot → Token kopieren</strong><br />
              Chat-ID: dem Bot schreiben, dann <code>api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> aufrufen
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>BOT TOKEN</label>
              <input type="password" placeholder="1234567890:AABBccDDee..." value={tgToken} onChange={(e) => setTgToken(e.target.value)}
                style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "8px 12px", color: "#f1f5f9", fontSize: "12px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              {(["TRADES", "SECURITY", "AI_ANALYSIS", "SYSTEM_HEALTH"] as const).map((ch) => (
                <div key={ch} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>{ch.replace("_", " ")}</span>
                    <button onClick={() => setTgChannels((p) => ({ ...p, [ch]: { ...p[ch], enabled: !p[ch].enabled } }))}
                      style={{ width: "36px", height: "20px", borderRadius: "10px", border: "none", cursor: "pointer", background: tgChannels[ch].enabled ? "#00c3ff" : "rgba(255,255,255,0.1)", position: "relative" }}>
                      <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: tgChannels[ch].enabled ? "19px" : "3px", transition: "left 0.15s" }} />
                    </button>
                  </div>
                  <input placeholder="Chat ID (-100...)" value={tgChannels[ch].chatId}
                    onChange={(e) => setTgChannels((p) => ({ ...p, [ch]: { ...p[ch], chatId: e.target.value } }))}
                    style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "5px 8px", color: "#f1f5f9", fontSize: "11px", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <button onClick={saveTelegram}
              style={{ padding: "8px 20px", borderRadius: "6px", border: "1px solid rgba(0,195,255,0.4)", cursor: "pointer", background: "rgba(0,195,255,0.12)", color: "#00c3ff", fontSize: "12px", fontFamily: "monospace", fontWeight: 700 }}>
              💾 Telegram speichern
            </button>
            {aiTestResult.telegram && (
              <div style={{ marginTop: "8px", padding: "8px 12px", borderRadius: "6px", fontSize: "11px", background: "rgba(16,201,109,0.1)", color: "#10c96d", border: "1px solid rgba(16,201,109,0.3)" }}>
                {aiTestResult.telegram.msg}
              </div>
            )}
          </div>
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

          <ChangeUsernameForm />

          <ChangePasswordForm />

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
