import fs from "fs";
import path from "path";
import type { AISettings, AIProviderConfig, TelegramSettingsConfig } from "./ai-config-types";

// Persist to a JSON file in the project root so keys survive server restarts
const PERSIST_PATH = path.join(process.cwd(), ".ai-config.json");

const DEFAULT_AI_SETTINGS: AISettings = {
  openai: {
    provider: "OPENAI",
    apiKey: "",
    model: "gpt-4o",
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
    model: "claude-sonnet-4-6",
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

function loadFromDisk(): AISettings {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, "utf-8");
      const parsed = JSON.parse(raw) as AISettings;
      // Merge with defaults so new fields are always present
      return {
        ...DEFAULT_AI_SETTINGS,
        ...parsed,
        openai: { ...DEFAULT_AI_SETTINGS.openai, ...parsed.openai },
        anthropic: { ...DEFAULT_AI_SETTINGS.anthropic, ...parsed.anthropic },
        telegram: { ...DEFAULT_AI_SETTINGS.telegram, ...parsed.telegram },
      };
    }
  } catch {
    // If file is corrupt, start fresh
  }
  return JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS));
}

function saveToDisk(settings: AISettings): void {
  try {
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(settings, null, 2), "utf-8");
  } catch {
    // Non-fatal — log silently
  }
}

// Load on module init (survives hot-reload via global cache)
const GLOBAL_KEY = "__ai_config_store__";
declare global {
  // eslint-disable-next-line no-var
  var __ai_config_store__: AISettings | undefined;
}

if (!global[GLOBAL_KEY]) {
  global[GLOBAL_KEY] = loadFromDisk();
}

function getStore(): AISettings {
  return global[GLOBAL_KEY]!;
}

function setStore(s: AISettings): void {
  global[GLOBAL_KEY] = s;
  saveToDisk(s);
}

export function getAISettings(): AISettings {
  return JSON.parse(JSON.stringify(getStore()));
}

export function updateOpenAI(patch: Partial<AIProviderConfig>): void {
  const s = getStore();
  setStore({
    ...s,
    openai: { ...s.openai, ...patch },
    updatedAt: new Date().toISOString(),
  });
}

export function updateAnthropic(patch: Partial<AIProviderConfig>): void {
  const s = getStore();
  setStore({
    ...s,
    anthropic: { ...s.anthropic, ...patch },
    updatedAt: new Date().toISOString(),
  });
}

export function updateTelegram(patch: Partial<TelegramSettingsConfig>): void {
  const s = getStore();
  setStore({
    ...s,
    telegram: { ...s.telegram, ...patch },
    updatedAt: new Date().toISOString(),
  });
}

export function saveOpenAIKey(apiKey: string, model: string): void {
  updateOpenAI({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

export function saveAnthropicKey(apiKey: string, model: string): void {
  updateAnthropic({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

export async function testOpenAIConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-")) {
    updateOpenAI({ testStatus: "FAILED", testError: "Key muss mit sk- beginnen", connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: "Key muss mit sk- beginnen (z.B. sk-proj-...)" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) {
      updateOpenAI({ testStatus: "FAILED", testError: "Ungültiger API Key", connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: "Ungültiger API Key (401 Unauthorized)" };
    }
    if (!res.ok) {
      const err = `HTTP ${res.status}`;
      updateOpenAI({ testStatus: "FAILED", testError: err, connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: err };
    }
    updateOpenAI({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() });
    return { ok: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Netzwerkfehler";
    updateOpenAI({ testStatus: "FAILED", testError: msg, connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: msg };
  }
}

export async function testAnthropicConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-ant-")) {
    updateAnthropic({ testStatus: "FAILED", testError: "Key muss mit sk-ant- beginnen", connected: false, lastTestedAt: new Date().toISOString() });
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
      updateAnthropic({ testStatus: "FAILED", testError: "Ungültiger API Key", connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: "Ungültiger API Key (401 Unauthorized)" };
    }
    if (!res.ok && res.status !== 400) {
      const err = `HTTP ${res.status}`;
      updateAnthropic({ testStatus: "FAILED", testError: err, connected: false, lastTestedAt: new Date().toISOString() });
      return { ok: false, error: err };
    }
    updateAnthropic({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() });
    return { ok: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Netzwerkfehler";
    updateAnthropic({ testStatus: "FAILED", testError: msg, connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: msg };
  }
}

export function saveTelegramConfig(botToken: string, channels: TelegramSettingsConfig["channels"]): void {
  updateTelegram({ botToken, channels, configured: !!botToken && botToken.length > 10 });
}
