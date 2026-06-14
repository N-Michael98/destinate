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
    { brokerKey: "CAPITAL_COM", connected: false, accountId: null, accountMode: "DEMO", lastConnectedAt: null, error: null },
    { brokerKey: "IC_MARKETS", connected: false, accountId: null, accountMode: "DEMO", lastConnectedAt: null, error: null },
  ],
  updatedAt: new Date().toISOString(),
};

async function getPrisma() {
  const { getPrisma: gp } = await import("../../app/lib/prisma");
  return gp();
}

async function loadFromDB(): Promise<SystemSettings> {
  try {
    const db = await getPrisma();
    const row = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "SystemSettings" WHERE id = 'singleton' LIMIT 1
    `;
    if (row && row.length > 0) {
      const parsed = JSON.parse(row[0].data) as SystemSettings;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        botSettings: { ...DEFAULT_SETTINGS.botSettings, ...parsed.botSettings },
        riskSettings: { ...DEFAULT_SETTINGS.riskSettings, ...parsed.riskSettings },
        connections: DEFAULT_SETTINGS.connections.map((def) => {
          const saved = parsed.connections?.find((c) => c.brokerKey === def.brokerKey);
          return saved ? { ...saved, connected: false, accountId: null, error: null } : def;
        }),
      };
    }
  } catch { /* DB not ready yet → use defaults */ }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

async function saveToDB(s: SystemSettings): Promise<void> {
  try {
    const db = await getPrisma();
    const data = JSON.stringify(s);
    await db.$executeRawUnsafe(
      `INSERT INTO "SystemSettings" (id, data, "updatedAt") VALUES ('singleton', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, "updatedAt" = NOW()`,
      data
    );
  } catch { /* non-fatal */ }
}

// In-memory cache so we don't hit DB on every read within same process
declare global { var __system_settings__: SystemSettings | undefined; }

async function get(): Promise<SystemSettings> {
  if (!global.__system_settings__) {
    global.__system_settings__ = await loadFromDB();
  }
  return global.__system_settings__!;
}

async function set(s: SystemSettings): Promise<void> {
  global.__system_settings__ = s;
  await saveToDB(s);
}

export async function getSettings(): Promise<SystemSettings> {
  return JSON.parse(JSON.stringify(await get()));
}

export async function updateBotSettings(patch: Partial<BotSettings>): Promise<void> {
  const s = await get();
  await set({ ...s, botSettings: { ...s.botSettings, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateRiskSettings(patch: Partial<RiskSettings>): Promise<void> {
  const s = await get();
  await set({ ...s, riskSettings: { ...s.riskSettings, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateBrokerConnection(patch: Partial<BrokerConnection> & { brokerKey: BrokerConnection["brokerKey"] }): Promise<void> {
  const s = await get();
  await set({ ...s, connections: s.connections.map((c) => c.brokerKey === patch.brokerKey ? { ...c, ...patch } : c), updatedAt: new Date().toISOString() });
}

export async function simulateBrokerConnect(
  brokerKey: BrokerConnection["brokerKey"],
  apiKey: string,
  accountMode: BrokerConnection["accountMode"]
): Promise<{ ok: boolean; accountId: string | null; error: string | null }> {
  if (!apiKey || apiKey.length < 8) {
    await updateBrokerConnection({ brokerKey, connected: false, error: "Invalid API key (minimum 8 characters)" });
    return { ok: false, accountId: null, error: "Invalid API key" };
  }
  const fakeId = `${brokerKey.slice(0, 3)}-DEMO-${Math.floor(Math.random() * 900000 + 100000)}`;
  await updateBrokerConnection({ brokerKey, connected: true, accountId: fakeId, accountMode, lastConnectedAt: new Date().toISOString(), error: null });
  return { ok: true, accountId: fakeId, error: null };
}

export async function simulateBrokerDisconnect(brokerKey: BrokerConnection["brokerKey"]): Promise<void> {
  await updateBrokerConnection({ brokerKey, connected: false, accountId: null, error: null });
}
