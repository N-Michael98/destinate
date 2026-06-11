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

// Save key without testing (instant, no network call)
export function saveOpenAIKey(apiKey: string, model: string): void {
  updateOpenAI({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

export function saveAnthropicKey(apiKey: string, model: string): void {
  updateAnthropic({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

// Real API test — makes actual network call to verify key
export async function testOpenAIConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-")) {
    updateOpenAI({ testStatus: "FAILED", testError: "Key muss mit sk- beginnen", connected: false, lastTestedAt: new Date().toISOString() });
    return { ok: false, error: "Key muss mit sk- beginnen (z.B. sk-proj-...)" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` },
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
    // Test with minimal message
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      }),
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

    // 200 or 400 both mean the key is valid (400 = model/param issue, key was accepted)
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
