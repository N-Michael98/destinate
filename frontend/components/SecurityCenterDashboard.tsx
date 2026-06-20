"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type SecurityStatus = "SECURE" | "MONITORING" | "ALERT" | "LOCKDOWN";
type ThreatLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type TelegramChannel = "TRADES" | "SECURITY" | "AI_ANALYSIS" | "SYSTEM_HEALTH";

interface SystemPermission {
  id: string;
  name: string;
  status: "ALLOWED" | "BLOCKED" | "REQUIRES_APPROVAL";
  description: string;
}
interface AuditEvent {
  id: string;
  timestamp: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  source: string;
  message: string;
}
interface SecurityReport {
  version: string;
  status: SecurityStatus;
  threatLevel: ThreatLevel;
  malwarebytesConnected: boolean;
  killswitchArmed: boolean;
  killswitchTriggered: boolean;
  telegramConfigured: boolean;
  brokerSessionsActive: number;
  openOrdersCount: number;
  permissions: SystemPermission[];
  auditLog: AuditEvent[];
  lastScanAt: string | null;
  lastThreatAt: string | null;
  summary: string;
  updatedAt: string;
}
interface MalwarebytesReport {
  connectionStatus: string;
  scanStatus: string;
  lastScanAt: string | null;
  lastScanDurationMs: number;
  threatsFound: number;
  threatsQuarantined: number;
  realtimeProtectionEnabled: boolean;
  webProtectionEnabled: boolean;
  protectionLayers: { name: string; enabled: boolean; status: string }[];
  dataAccess: { tradingDataAccess: false; apiKeysAccess: false; brokerDataAccess: false; positionsAccess: false; accessScope: string };
  systemNote: string;
  updatedAt: string;
}
interface KillswitchStage { stage: string; status: string; startedAt: string | null; completedAt: string | null; details: string }
interface KillswitchReport {
  armed: boolean;
  triggered: boolean;
  currentStage: string;
  trigger: string | null;
  triggeredAt: string | null;
  triggeredBy: string | null;
  stages: KillswitchStage[];
  brokersLoggedOut: string[];
  ordersCancelled: number;
  systemLocked: boolean;
  telegramAlertSent: boolean;
  canReset: boolean;
  summary: string;
  updatedAt: string;
}
interface TelegramChannelConfig { channel: TelegramChannel; label: string; description: string; chatId: string; enabled: boolean; icon: string }
interface TelegramMessage { id: string; channel: TelegramChannel; priority: string; text: string; sentAt: string; status: string; source: string }
interface TelegramReport {
  botConfigured: boolean;
  botToken: string | null;
  channels: TelegramChannelConfig[];
  recentMessages: TelegramMessage[];
  totalSent: number;
  totalFailed: number;
  lastMessageAt: string | null;
  simulationMode: boolean;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(s: SecurityStatus | string) {
  if (s === "SECURE") return "text-emerald-400";
  if (s === "MONITORING") return "text-blue-400";
  if (s === "ALERT") return "text-orange-400";
  if (s === "LOCKDOWN") return "text-red-400";
  return "text-slate-400";
}
function threatColor(t: ThreatLevel | string) {
  if (t === "NONE") return "text-emerald-400";
  if (t === "LOW") return "text-yellow-400";
  if (t === "MEDIUM") return "text-orange-400";
  if (t === "HIGH" || t === "CRITICAL") return "text-red-400";
  return "text-slate-400";
}
function permCls(s: string) {
  if (s === "ALLOWED") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (s === "BLOCKED") return "border-red-500/40 bg-red-500/10 text-red-300";
  return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
}
function severityCls(s: string) {
  if (s === "CRITICAL") return "text-red-400";
  if (s === "WARNING") return "text-orange-400";
  return "text-slate-400";
}
function stageCls(s: string) {
  if (s === "COMPLETED") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (s === "RUNNING") return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  if (s === "FAILED") return "border-red-500/40 bg-red-500/10 text-red-300";
  return "border-slate-600 bg-slate-800 text-slate-400";
}
function msgStatusCls(s: string) {
  if (s === "SENT") return "text-emerald-400";
  if (s === "FAILED") return "text-red-400";
  if (s === "SIMULATED") return "text-yellow-400";
  return "text-slate-400";
}
function channelColor(c: TelegramChannel) {
  if (c === "TRADES") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (c === "SECURITY") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (c === "AI_ANALYSIS") return "border-violet-500/40 bg-violet-500/10 text-violet-300";
  return "border-blue-500/40 bg-blue-500/10 text-blue-300";
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}
function KpiCard({ label, value, sub, accent = "text-white" }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-black ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Tab Types ────────────────────────────────────────────────────────────────
type Tab = "overview" | "malwarebytes" | "killswitch" | "telegram" | "audit" | "permissions";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SecurityCenterDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [security, setSecurity] = useState<SecurityReport | null>(null);
  const [malwarebytes, setMalwarebytes] = useState<MalwarebytesReport | null>(null);
  const [killswitch, setKillswitch] = useState<KillswitchReport | null>(null);
  const [telegram, setTelegram] = useState<TelegramReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [ksConfirm, setKsConfirm] = useState(false);
  const [ksLoading, setKsLoading] = useState(false);

  // Telegram form state
  const [botToken, setBotToken] = useState("");
  const [channelForms, setChannelForms] = useState<Record<TelegramChannel, { chatId: string; enabled: boolean }>>({
    TRADES: { chatId: "", enabled: false },
    SECURITY: { chatId: "", enabled: false },
    AI_ANALYSIS: { chatId: "", enabled: false },
    SYSTEM_HEALTH: { chatId: "", enabled: false },
  });
  const [tgSaving, setTgSaving] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [s, m, k, t] = await Promise.all([
        fetch("/api/security-center").then((r) => r.json()).catch(() => ({ report: null })),
        fetch("/api/security-center/malwarebytes").then((r) => r.json()).catch(() => ({ report: null })),
        fetch("/api/security-center/killswitch").then((r) => r.json()).catch(() => ({ report: null })),
        fetch("/api/security-center/telegram").then((r) => r.json()).catch(() => ({ report: null })),
      ]);
      setSecurity(s.report);
      setMalwarebytes(m.report);
      setKillswitch(k.report);
      setTelegram(t.report);
      if (t.report?.channels) {
        const forms: Record<TelegramChannel, { chatId: string; enabled: boolean }> = {
          TRADES: { chatId: "", enabled: false },
          SECURITY: { chatId: "", enabled: false },
          AI_ANALYSIS: { chatId: "", enabled: false },
          SYSTEM_HEALTH: { chatId: "", enabled: false },
        };
        for (const ch of t.report.channels as TelegramChannelConfig[]) {
          forms[ch.channel] = { chatId: ch.chatId, enabled: ch.enabled };
        }
        setChannelForms(forms);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load security data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleKillswitch(action: "trigger" | "reset") {
    setKsLoading(true);
    try {
      const body = action === "trigger"
        ? { action: "trigger", trigger: "MANUAL", triggeredBy: "Security Center UI" }
        : { action: "reset" };
      const r = await fetch("/api/security-center/killswitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setKillswitch(d.report);
      setKsConfirm(false);
      await loadAll();
    } finally {
      setKsLoading(false);
    }
  }

  async function saveTelegramConfig() {
    setTgSaving(true);
    try {
      const channels = (Object.entries(channelForms) as [TelegramChannel, { chatId: string; enabled: boolean }][]).map(
        ([channel, { chatId, enabled }]) => ({ channel, chatId, enabled })
      );
      await fetch("/api/security-center/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "configure", botToken, channels }),
      });
      await loadAll();
    } finally {
      setTgSaving(false);
    }
  }

  async function testChannel(channel: TelegramChannel) {
    setTgTestResult(null);
    const r = await fetch("/api/security-center/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", channel }),
    });
    const d = await r.json();
    setTgTestResult(`${channel}: ${d.status}${d.message ? ` — ${d.message}` : ""}`);
    await loadAll();
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "🛡️" },
    { id: "malwarebytes", label: "Malwarebytes", icon: "🔬" },
    { id: "killswitch", label: "Kill Switch", icon: "⚡" },
    { id: "telegram", label: "Telegram", icon: "📲" },
    { id: "audit", label: "Audit Log", icon: "📋" },
    { id: "permissions", label: "Permissions", icon: "🔐" },
  ];

  const isLockdown = killswitch?.triggered || security?.status === "LOCKDOWN";

  return (
    <section className={`rounded-2xl border p-8 ${isLockdown ? "bg-red-950/20 border-red-700" : "bg-gray-900 border-red-900"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-400 mb-2">V17.0.0</p>
          <h2 className="text-4xl font-black text-white">Security Center</h2>
          <p className="text-gray-400 text-lg mt-3 max-w-3xl">
            Malwarebytes Schutz · Kill Switch · Telegram Multi-Channel · Audit Log · Permissions
          </p>
        </div>
        <div className="flex flex-col gap-3 min-w-[220px]">
          <div className={`border rounded-2xl p-5 ${isLockdown ? "bg-red-950/60 border-red-600" : "bg-black border-red-800"}`}>
            <p className="text-gray-400 text-sm">Security Status</p>
            <p className={`text-2xl font-bold mt-1 ${statusColor(security?.status ?? "MONITORING")}`}>
              {security?.status ?? "—"}
            </p>
            <p className={`text-sm font-bold mt-1 ${threatColor(security?.threatLevel ?? "NONE")}`}>
              Threat: {security?.threatLevel ?? "—"}
            </p>
          </div>
          <button onClick={loadAll} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-bold rounded-xl px-4 py-2 transition">
            Refresh
          </button>
        </div>
      </div>

      {isLockdown && (
        <div className="mb-6 rounded-2xl border border-red-600 bg-red-950/60 p-5">
          <p className="text-red-300 font-black text-xl">🚨 SYSTEM LOCKDOWN AKTIV</p>
          <p className="text-red-400 text-sm mt-2">{killswitch?.summary}</p>
          <p className="text-red-500 text-xs mt-1">Alle Broker getrennt · Alle Orders gecancelt · Execution gesperrt</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition flex items-center gap-2 ${
              tab === t.id
                ? "bg-red-900/40 border-red-600 text-red-300"
                : "bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading && <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-400">Lade Security Daten...</div>}
      {!loading && fetchError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          ⚠ Verbindungsfehler: {fetchError} — API-Route nicht erreichbar. Bitte Server neu starten.
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {!loading && tab === "overview" && security && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Status" value={security.status} accent={statusColor(security.status)} />
            <KpiCard label="Threat Level" value={security.threatLevel} accent={threatColor(security.threatLevel)} />
            <KpiCard label="Broker Sessions" value={security.brokerSessionsActive} sub="Active connections" accent={security.brokerSessionsActive > 0 ? "text-blue-400" : "text-red-400"} />
            <KpiCard label="Open Orders" value={security.openOrdersCount} sub="Paper orders" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Malwarebytes" value="Simulated" accent="text-yellow-400" />
            <KpiCard label="Kill Switch" value={security.killswitchTriggered ? "TRIGGERED" : security.killswitchArmed ? "Armed" : "Disarmed"} accent={security.killswitchTriggered ? "text-red-400" : "text-emerald-400"} />
            <KpiCard label="Telegram" value={security.telegramConfigured ? "Configured" : "Not set"} accent={security.telegramConfigured ? "text-emerald-400" : "text-yellow-400"} />
            <KpiCard label="Last Scan" value={security.lastScanAt ? new Date(security.lastScanAt).toLocaleTimeString() : "Never"} />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h3 className="text-lg font-bold text-white mb-3">System Summary</h3>
            <p className="text-slate-300 text-sm">{security.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip label="LIVE TRADING: BLOCKED" cls="border-red-500/40 bg-red-500/10 text-red-300" />
              <Chip label="DATA EXPOSURE: BLOCKED" cls="border-red-500/40 bg-red-500/10 text-red-300" />
              <Chip label="MB ACCESS: STATUS ONLY" cls="border-yellow-500/40 bg-yellow-500/10 text-yellow-300" />
            </div>
            <p className="mt-3 text-xs text-slate-500">Updated: {new Date(security.updatedAt).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ── MALWAREBYTES ── */}
      {!loading && tab === "malwarebytes" && malwarebytes && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-yellow-800/40 bg-yellow-950/20 p-5">
            <p className="text-yellow-300 font-bold text-sm">🔒 Datenschutz-Garantie</p>
            <p className="text-yellow-400/80 text-xs mt-2">{malwarebytes.dataAccess.accessScope} — Malwarebytes hat keinen Zugriff auf Handelsdaten, API Keys, Broker-Zugangsdaten oder Positionen. Nur der Schutzstatus ist zugänglich.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Connection" value={malwarebytes.connectionStatus} accent={malwarebytes.connectionStatus === "CONNECTED" ? "text-emerald-400" : malwarebytes.connectionStatus === "SIMULATED" ? "text-yellow-400" : "text-red-400"} />
            <KpiCard label="Scan Status" value={malwarebytes.scanStatus} accent={malwarebytes.scanStatus === "CLEAN" ? "text-emerald-400" : "text-red-400"} />
            <KpiCard label="Threats Found" value={malwarebytes.threatsFound} accent={malwarebytes.threatsFound === 0 ? "text-emerald-400" : "text-red-400"} />
            <KpiCard label="Quarantined" value={malwarebytes.threatsQuarantined} accent="text-yellow-400" />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Protection Layers</h3>
              <div className="space-y-3">
                {malwarebytes.protectionLayers.map((layer) => (
                  <div key={layer.name} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{layer.name}</span>
                    <Chip label={layer.status} cls={layer.status === "ACTIVE" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Data Access Restrictions</h3>
              <div className="space-y-3">
                {[
                  ["Trading Data", malwarebytes.dataAccess.tradingDataAccess],
                  ["API Keys", malwarebytes.dataAccess.apiKeysAccess],
                  ["Broker Data", malwarebytes.dataAccess.brokerDataAccess],
                  ["Positions", malwarebytes.dataAccess.positionsAccess],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{String(label)}</span>
                    <Chip label={val ? "ACCESSIBLE" : "BLOCKED"} cls={val ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"} />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Last scan: {malwarebytes.lastScanAt ? new Date(malwarebytes.lastScanAt).toLocaleString() : "—"}
                {" · "}Duration: {(malwarebytes.lastScanDurationMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs text-slate-400">{malwarebytes.systemNote}</p>
          </div>
        </div>
      )}

      {/* ── KILL SWITCH ── */}
      {!loading && tab === "killswitch" && killswitch && (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-6 ${killswitch.triggered ? "border-red-600 bg-red-950/40" : "border-slate-700 bg-slate-900/80"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-white">Kill Switch</h3>
                <p className={`text-lg font-bold mt-2 ${killswitch.triggered ? "text-red-400" : killswitch.armed ? "text-emerald-400" : "text-slate-400"}`}>
                  {killswitch.triggered ? "⚡ TRIGGERED" : killswitch.armed ? "🟢 Armed — Standby" : "⚪ Disarmed"}
                </p>
                {killswitch.triggered && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-red-300">Trigger: <span className="font-bold">{killswitch.trigger}</span></p>
                    <p className="text-sm text-red-300">By: <span className="font-bold">{killswitch.triggeredBy}</span></p>
                    <p className="text-sm text-red-300">At: <span className="font-bold">{killswitch.triggeredAt ? new Date(killswitch.triggeredAt).toLocaleString() : "—"}</span></p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {!killswitch.triggered && !ksConfirm && (
                  <button onClick={() => setKsConfirm(true)} className="bg-red-900/60 hover:bg-red-800 border border-red-600 text-red-300 font-black px-6 py-3 rounded-xl text-sm transition">
                    ⚡ TRIGGER KILL SWITCH
                  </button>
                )}
                {!killswitch.triggered && ksConfirm && (
                  <div className="space-y-2">
                    <p className="text-red-400 text-xs font-bold text-center">Bist du sicher? Alle Broker werden getrennt!</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleKillswitch("trigger")} disabled={ksLoading} className="bg-red-700 hover:bg-red-600 border border-red-500 text-white font-black px-4 py-2 rounded-xl text-sm transition flex-1">
                        {ksLoading ? "..." : "✓ BESTÄTIGEN"}
                      </button>
                      <button onClick={() => setKsConfirm(false)} className="bg-slate-800 border border-slate-600 text-slate-300 px-4 py-2 rounded-xl text-sm">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
                {killswitch.triggered && killswitch.canReset && (
                  <button onClick={() => handleKillswitch("reset")} disabled={ksLoading} className="bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-600 text-emerald-300 font-bold px-6 py-3 rounded-xl text-sm transition">
                    {ksLoading ? "..." : "🔄 RESET SYSTEM"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white">Shutdown Sequence</h3>
            {killswitch.stages.map((stage, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-bold text-white text-sm">{stage.stage}</p>
                  <Chip label={stage.status} cls={stageCls(stage.status)} />
                </div>
                <p className="text-xs text-slate-400">{stage.details || "Awaiting trigger."}</p>
                {stage.completedAt && (
                  <p className="text-xs text-slate-600 mt-1">Completed: {new Date(stage.completedAt).toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>

          {killswitch.triggered && (
            <div className="grid lg:grid-cols-3 gap-4">
              <KpiCard label="Brokers Disconnected" value={killswitch.brokersLoggedOut.join(", ") || "None"} accent="text-red-400" />
              <KpiCard label="Orders Cancelled" value={killswitch.ordersCancelled} accent="text-orange-400" />
              <KpiCard label="Telegram Alert" value={killswitch.telegramAlertSent ? "Sent ✓" : "Not sent"} accent={killswitch.telegramAlertSent ? "text-emerald-400" : "text-slate-400"} />
            </div>
          )}
        </div>
      )}

      {/* ── TELEGRAM ── */}
      {!loading && tab === "telegram" && telegram && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Bot Konfiguration</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2 block">Telegram Bot Token</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrSTUVwxyz"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">Erstelle einen Bot via @BotFather auf Telegram. Token bleibt server-seitig.</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {telegram.channels.map((ch) => (
              <div key={ch.channel} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ch.icon}</span>
                    <div>
                      <p className="font-bold text-white">{ch.label}</p>
                      <p className="text-xs text-slate-500">{ch.description}</p>
                    </div>
                  </div>
                  <Chip
                    label={channelForms[ch.channel].enabled ? "Aktiv" : "Inaktiv"}
                    cls={channelForms[ch.channel].enabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-600 bg-slate-800 text-slate-400"}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1 block">Chat ID</label>
                    <input
                      type="text"
                      value={channelForms[ch.channel].chatId}
                      onChange={(e) => setChannelForms((prev) => ({ ...prev, [ch.channel]: { ...prev[ch.channel], chatId: e.target.value } }))}
                      placeholder="-1001234567890"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => setChannelForms((prev) => ({ ...prev, [ch.channel]: { ...prev[ch.channel], enabled: !prev[ch.channel].enabled } }))}
                        className={`w-10 h-5 rounded-full transition cursor-pointer ${channelForms[ch.channel].enabled ? "bg-emerald-500" : "bg-slate-700"}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-all ${channelForms[ch.channel].enabled ? "ml-5" : "ml-0.5"}`} />
                      </div>
                      <span className="text-sm text-slate-300">Aktiviert</span>
                    </label>
                    <button
                      onClick={() => testChannel(ch.channel)}
                      className="text-xs border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"
                    >
                      Test senden
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {tgTestResult && (
            <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-3 text-sm text-blue-300">
              {tgTestResult}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={saveTelegramConfig}
              disabled={tgSaving}
              className="bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-600 text-emerald-300 font-bold px-6 py-3 rounded-xl text-sm transition"
            >
              {tgSaving ? "Speichere..." : "✓ Konfiguration Speichern"}
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <KpiCard label="Bot Token" value={telegram.botToken ?? "Nicht konfiguriert"} accent={telegram.botConfigured ? "text-emerald-400" : "text-yellow-400"} />
            <KpiCard label="Nachrichten Gesendet" value={telegram.totalSent} accent="text-emerald-400" />
            <KpiCard label="Fehlgeschlagen" value={telegram.totalFailed} accent={telegram.totalFailed > 0 ? "text-red-400" : "text-slate-400"} />
          </div>

          {telegram.recentMessages.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white mb-4">Letzte Nachrichten</h3>
              <div className="space-y-3">
                {telegram.recentMessages.slice(-10).reverse().map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3 border-b border-slate-800 pb-3 last:border-0">
                    <Chip label={msg.channel} cls={channelColor(msg.channel as TelegramChannel)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{msg.text}</p>
                      <p className="text-xs text-slate-600 mt-1">{msg.source} · {new Date(msg.sentAt).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${msgStatusCls(msg.status)}`}>{msg.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {!loading && tab === "audit" && security && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white">Audit Log</h3>
          {security.auditLog.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0 text-right min-w-[70px]">
                  <p className={`text-xs font-bold ${severityCls(event.severity)}`}>{event.severity}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{event.id}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Chip label={event.type.replace(/_/g, " ")} cls="border-slate-600 bg-slate-800 text-slate-400" />
                    <span className="text-xs text-slate-500">{event.source}</span>
                  </div>
                  <p className="text-sm text-slate-300">{event.message}</p>
                  <p className="text-xs text-slate-600 mt-1">{new Date(event.timestamp).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PERMISSIONS ── */}
      {!loading && tab === "permissions" && security && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">System Permissions</h3>
          <div className="grid lg:grid-cols-2 gap-4">
            {security.permissions.map((perm) => (
              <div key={perm.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-bold text-white">{perm.name}</p>
                  <Chip label={perm.status} cls={permCls(perm.status)} />
                </div>
                <p className="text-xs text-slate-400">{perm.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
