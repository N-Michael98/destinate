import type { AISettings, AIProviderConfig, TelegramSettingsConfig } from "./ai-config-types";

const DEFAULT_AI_SETTINGS: AISettings = {
  openai: {
    provider: "OPENAI",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    connected: false,
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testError: null,
  },
  anthropic: {
    provider: "ANTHROPIC",
    apiKey: "",
    model: "claude-haiku-4-5-20251001",
    temperature: 0.3,
    maxTokens: 2048,
    connected: false,
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testError: null,
  },
  telegram: {
    botToken: "",
    configured: false,
    channels: {
      TRADES: { chatId: "", enabled: false },
      SECURITY: { chatId: "", enabled: false },
      AI_ANALYSIS: { chatId: "", enabled: false },
      SYSTEM_HEALTH: { chatId: "", enabled: false },
    },
  },
  updatedAt: new Date().toISOString(),
};

async function getPrisma() {
  const { getPrisma: gp } = await import("../../app/lib/prisma");
  return gp();
}

async function loadFromDB(): Promise<AISettings> {
  let settings: AISettings = JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS));
  try {
    const db = await getPrisma();
    const row = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "AIConfig" WHERE id = 'singleton' LIMIT 1
    `;
    if (row && row.length > 0) {
      const parsed = JSON.parse(row[0].data) as AISettings;
      settings = {
        ...DEFAULT_AI_SETTINGS,
        ...parsed,
        openai: { ...DEFAULT_AI_SETTINGS.openai, ...parsed.openai },
        anthropic: { ...DEFAULT_AI_SETTINGS.anthropic, ...parsed.anthropic },
        telegram: {
          ...DEFAULT_AI_SETTINGS.telegram,
          ...parsed.telegram,
          channels: { ...DEFAULT_AI_SETTINGS.telegram.channels, ...parsed.telegram?.channels },
        },
      };
    }
  } catch { /* DB not ready → use defaults */ }

  // Railway Variables override DB — env vars take precedence
  const envOpenAI = process.env.OPENAI_API_KEY;
  const envAnthropic = process.env.ANTHROPIC_API_KEY;
  const envTelegram = process.env.TELEGRAM_BOT_TOKEN;
  if (envOpenAI && envOpenAI.length > 20) {
    settings.openai = { ...settings.openai, apiKey: envOpenAI, connected: true, testStatus: "OK" };
  }
  if (envAnthropic && envAnthropic.length > 20) {
    settings.anthropic = { ...settings.anthropic, apiKey: envAnthropic, connected: true, testStatus: "OK" };
  }
  if (envTelegram && envTelegram.length > 10) {
    settings.telegram = { ...settings.telegram, botToken: envTelegram, configured: true };
  }

  return settings;
}

async function saveToDB(settings: AISettings): Promise<void> {
  try {
    const db = await getPrisma();
    const data = JSON.stringify(settings);
    await db.$executeRawUnsafe(
      `INSERT INTO "AIConfig" (id, data, "updatedAt") VALUES ('singleton', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, "updatedAt" = NOW()`,
      data
    );
  } catch { /* non-fatal */ }
}

declare global { var __ai_config_store__: AISettings | undefined; }

async function getStore(): Promise<AISettings> {
  if (!global.__ai_config_store__) {
    global.__ai_config_store__ = await loadFromDB();
  }
  return global.__ai_config_store__!;
}

async function setStore(s: AISettings): Promise<void> {
  global.__ai_config_store__ = s;
  await saveToDB(s);
}

export async function getAISettings(): Promise<AISettings> {
  return JSON.parse(JSON.stringify(await getStore()));
}

export async function updateOpenAI(patch: Partial<AIProviderConfig>): Promise<void> {
  const s = await getStore();
  await setStore({ ...s, openai: { ...s.openai, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateAnthropic(patch: Partial<AIProviderConfig>): Promise<void> {
  const s = await getStore();
  await setStore({ ...s, anthropic: { ...s.anthropic, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateTelegram(patch: Partial<TelegramSettingsConfig>): Promise<void> {
  const s = await getStore();
  await setStore({ ...s, telegram: { ...s.telegram, ...patch }, updatedAt: new Date().toISOString() });
}

export async function saveOpenAIKey(apiKey: string, model: string): Promise<void> {
  await updateOpenAI({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

export async function saveAnthropicKey(apiKey: string, model: string): Promise<void> {
  await updateAnthropic({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

export async function testOpenAIConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-")) {
    await updateOpenAI({ testStatus: "FAILED", testError: "Key muss mit sk- beginnen", connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: "Key muss mit sk- beginnen (z.B. sk-proj-...)" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) {
      await updateOpenAI({ testStatus: "FAILED", testError: "Ungültiger API Key", connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: "Ungültiger API Key (401 Unauthorized)" };
    }
    if (!res.ok) {
      const err = `HTTP ${res.status}`;
      await updateOpenAI({ testStatus: "FAILED", testError: err, connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: err };
    }
    await updateOpenAI({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() });
    return { ok: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Netzwerkfehler";
    await updateOpenAI({ testStatus: "FAILED", testError: msg, connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: msg };
  }
}

export async function testAnthropicConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-ant-")) {
    await updateAnthropic({ testStatus: "FAILED", testError: "Key muss mit sk-ant- beginnen", connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: "Key muss mit sk-ant- beginnen" };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: "user", content: "ping" }] }),
    });
    if (res.status === 401) {
      await updateAnthropic({ testStatus: "FAILED", testError: "Ungültiger API Key", connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: "Ungültiger API Key (401 Unauthorized)" };
    }
    if (!res.ok && res.status !== 400) {
      const err = `HTTP ${res.status}`;
      await updateAnthropic({ testStatus: "FAILED", testError: err, connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: err };
    }
    await updateAnthropic({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() });
    return { ok: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Netzwerkfehler";
    await updateAnthropic({ testStatus: "FAILED", testError: msg, connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: msg };
  }
}

export async function saveTelegramConfig(botToken: string, channels: TelegramSettingsConfig["channels"]): Promise<void> {
  await updateTelegram({ botToken, channels, configured: !!botToken && botToken.length > 10 });
}
