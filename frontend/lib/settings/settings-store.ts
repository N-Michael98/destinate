import fs from "fs";
import path from "path";
import type { SystemSettings, BrokerConnection, BotSettings, RiskSettings } from "../broker-config";

const PERSIST_PATH = path.join(process.cwd(), ".system-settings.json");

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
    { brokerKey: "CAPITAL_COM", connected: false, accountId: null, accountMode: "DEMO", lastConnectedAt: null, error: null },
    { brokerKey: "IC_MARKETS", connected: false, accountId: null, accountMode: "DEMO", lastConnectedAt: null, error: null },
  ],
  updatedAt: new Date().toISOString(),
};

function loadFromDisk(): SystemSettings {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(PERSIST_PATH, "utf-8")) as SystemSettings;
      // Reset connection status on reload — session tokens are gone, must reconnect
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        botSettings: { ...DEFAULT_SETTINGS.botSettings, ...parsed.botSettings },
        riskSettings: { ...DEFAULT_SETTINGS.riskSettings, ...parsed.riskSettings },
        connections: DEFAULT_SETTINGS.connections.map((def) => {
          const saved = parsed.connections?.find((c) => c.brokerKey === def.brokerKey);
          // Keep config but reset live session state
          return saved ? { ...saved, connected: false, accountId: null, error: null } : def;
        }),
      };
    }
  } catch { /* corrupt file → start fresh */ }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function saveToDisk(s: SystemSettings): void {
  try { fs.writeFileSync(PERSIST_PATH, JSON.stringify(s, null, 2), "utf-8"); } catch { /* non-fatal */ }
}

declare global { var __system_settings__: SystemSettings | undefined; }
if (!global.__system_settings__) global.__system_settings__ = loadFromDisk();

function get(): SystemSettings { return global.__system_settings__!; }
function set(s: SystemSettings): void { global.__system_settings__ = s; saveToDisk(s); }

export function getSettings(): SystemSettings { return JSON.parse(JSON.stringify(get())); }

export function updateBotSettings(patch: Partial<BotSettings>): void {
  const s = get();
  set({ ...s, botSettings: { ...s.botSettings, ...patch }, updatedAt: new Date().toISOString() });
}

export function updateRiskSettings(patch: Partial<RiskSettings>): void {
  const s = get();
  set({ ...s, riskSettings: { ...s.riskSettings, ...patch }, updatedAt: new Date().toISOString() });
}

export function updateBrokerConnection(patch: Partial<BrokerConnection> & { brokerKey: BrokerConnection["brokerKey"] }): void {
  const s = get();
  set({ ...s, connections: s.connections.map((c) => c.brokerKey === patch.brokerKey ? { ...c, ...patch } : c), updatedAt: new Date().toISOString() });
}

export function simulateBrokerConnect(
  brokerKey: BrokerConnection["brokerKey"],
  apiKey: string,
  accountMode: BrokerConnection["accountMode"]
): { ok: boolean; accountId: string | null; error: string | null } {
  if (!apiKey || apiKey.length < 8) {
    updateBrokerConnection({ brokerKey, connected: false, error: "Invalid API key (minimum 8 characters)" });
    return { ok: false, accountId: null, error: "Invalid API key" };
  }
  const fakeId = `${brokerKey.slice(0, 3)}-DEMO-${Math.floor(Math.random() * 900000 + 100000)}`;
  updateBrokerConnection({ brokerKey, connected: true, accountId: fakeId, accountMode, lastConnectedAt: new Date().toISOString(), error: null });
  return { ok: true, accountId: fakeId, error: null };
}

export function simulateBrokerDisconnect(brokerKey: BrokerConnection["brokerKey"]): void {
  updateBrokerConnection({ brokerKey, connected: false, accountId: null, error: null });
}
