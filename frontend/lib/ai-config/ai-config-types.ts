export type AIProvider = "OPENAI" | "ANTHROPIC";
export type OpenAIModel = "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-3.5-turbo";
export type AnthropicModel = "claude-sonnet-4-6" | "claude-opus-4-8" | "claude-haiku-4-5-20251001";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  connected: boolean;
  lastTestedAt: string | null;
  testStatus: "UNTESTED" | "OK" | "FAILED";
  testError: string | null;
}

export interface TelegramSettingsConfig {
  botToken: string;
  configured: boolean;
  channels: {
    TRADES: { chatId: string; enabled: boolean };
    SECURITY: { chatId: string; enabled: boolean };
    AI_ANALYSIS: { chatId: string; enabled: boolean };
    SYSTEM_HEALTH: { chatId: string; enabled: boolean };
  };
}

export interface AISettings {
  openai: AIProviderConfig;
  anthropic: AIProviderConfig;
  telegram: TelegramSettingsConfig;
  updatedAt: string;
}
