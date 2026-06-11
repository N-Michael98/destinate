import type { SystemSettings, BrokerConnection, BotSettings, RiskSettings } from "../broker-config";

const DEFAULT_SETTINGS: SystemSettings = {
  version: "V17.0.0",
  botSettings: {
    mode: "MANUAL",
    maxTradesPerDay: 5,
    maxConcurrentPositions: 3,
    autoApproveThreshold: 80,
    pauseOnLoss: true,
    pauseOnLossPercent: 3,
  },
  riskSettings: {
    maxRiskPerTradePct: 1.0,
    maxDailyDrawdownPct: 3.0,
    maxTotalDrawdownPct: 10.0,
    maxExposurePct: 20.0,
    minConfidenceScore: 65,
  },
  connections: [
    {
      brokerKey: "CAPITAL_COM",
      connected: false,
      accountId: null,
      accountMode: "DEMO",
      lastConnectedAt: null,
      error: null,
    },
    {
      brokerKey: "IC_MARKETS",
      connected: false,
      accountId: null,
      accountMode: "DEMO",
      lastConnectedAt: null,
      error: null,
    },
  ],
  updatedAt: new Date().toISOString(),
};

let _settings: SystemSettings = { ...DEFAULT_SETTINGS };

export function getSettings(): SystemSettings {
  return { ..._settings };
}

export function updateBotSettings(patch: Partial<BotSettings>): void {
  _settings = {
    ..._settings,
    botSettings: { ..._settings.botSettings, ...patch },
    updatedAt: new Date().toISOString(),
  };
}

export function updateRiskSettings(patch: Partial<RiskSettings>): void {
  _settings = {
    ..._settings,
    riskSettings: { ..._settings.riskSettings, ...patch },
    updatedAt: new Date().toISOString(),
  };
}

export function updateBrokerConnection(patch: Partial<BrokerConnection> & { brokerKey: BrokerConnection["brokerKey"] }): void {
  const connections = _settings.connections.map((c) =>
    c.brokerKey === patch.brokerKey ? { ...c, ...patch } : c
  );
  _settings = { ..._settings, connections, updatedAt: new Date().toISOString() };
}

export function simulateBrokerConnect(
  brokerKey: BrokerConnection["brokerKey"],
  apiKey: string,
  accountMode: BrokerConnection["accountMode"]
): { ok: boolean; accountId: string | null; error: string | null } {
  // Simulation only — no real broker connection
  if (!apiKey || apiKey.length < 8) {
    updateBrokerConnection({ brokerKey, connected: false, error: "Invalid API key (minimum 8 characters)" });
    return { ok: false, accountId: null, error: "Invalid API key" };
  }
  const fakeId = `${brokerKey.slice(0, 3)}-DEMO-${Math.floor(Math.random() * 900000 + 100000)}`;
  updateBrokerConnection({
    brokerKey,
    connected: true,
    accountId: fakeId,
    accountMode,
    lastConnectedAt: new Date().toISOString(),
    error: null,
  });
  return { ok: true, accountId: fakeId, error: null };
}

export function simulateBrokerDisconnect(brokerKey: BrokerConnection["brokerKey"]): void {
  updateBrokerConnection({ brokerKey, connected: false, accountId: null, error: null });
}
