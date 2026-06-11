export type TelegramChannel =
  | "TRADES"
  | "SECURITY"
  | "AI_ANALYSIS"
  | "SYSTEM_HEALTH";

export type TelegramMessagePriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type TelegramDeliveryStatus = "SENT" | "FAILED" | "PENDING" | "SIMULATED";

export interface TelegramChannelConfig {
  channel: TelegramChannel;
  label: string;
  description: string;
  chatId: string;
  enabled: boolean;
  icon: string;
}

export interface TelegramMessage {
  id: string;
  channel: TelegramChannel;
  priority: TelegramMessagePriority;
  text: string;
  sentAt: string;
  status: TelegramDeliveryStatus;
  source: string;
}

export interface TelegramNotificationReport {
  version: "V17.0.0";
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
