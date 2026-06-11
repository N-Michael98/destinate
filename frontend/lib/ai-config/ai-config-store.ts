import type { AISettings, AIProviderConfig, TelegramSettingsConfig } from "./ai-config-types";

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

let _aiSettings: AISettings = JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS));

export function getAISettings(): AISettings {
  return JSON.parse(JSON.stringify(_aiSettings));
}

export function updateOpenAI(patch: Partial<AIProviderConfig>): void {
  _aiSettings = {
    ..._aiSettings,
    openai: { ..._aiSettings.openai, ...patch },
    updatedAt: new Date().toISOString(),
  };
}

export function updateAnthropic(patch: Partial<AIProviderConfig>): void {
  _aiSettings = {
    ..._aiSettings,
    anthropic: { ..._aiSettings.anthropic, ...patch },
    updatedAt: new Date().toISOString(),
  };
}

export function updateTelegram(patch: Partial<TelegramSettingsConfig>): void {
  _aiSettings = {
    ..._aiSettings,
    telegram: { ..._aiSettings.telegram, ...patch },
    updatedAt: new Date().toISOString(),
  };
}

export async function testOpenAIConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  // Simulation — no real API call
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-")) {
    updateOpenAI({ testStatus: "FAILED", testError: "Invalid API key format (must start with sk-)", connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: "Invalid API key format" };
  }
  updateOpenAI({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() });
  return { ok: true, error: null };
}

export async function testAnthropicConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  // Simulation — no real API call
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-ant-")) {
    updateAnthropic({ testStatus: "FAILED", testError: "Invalid API key format (must start with sk-ant-)", connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: "Invalid API key format" };
  }
  updateAnthropic({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() });
  return { ok: true, error: null };
}

export function saveTelegramConfig(botToken: string, channels: TelegramSettingsConfig["channels"]): void {
  updateTelegram({ botToken, channels, configured: !!botToken && botToken.length > 10 });
}
