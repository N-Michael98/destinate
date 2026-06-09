export type TelegramAlertLevel = "CRITICAL" | "REVIEW" | "HEALTHY";

export type TelegramAlertPayload = {
  system: "AI_TRADING_SYSTEM";
  source: "MISSION_CONTROL";
  level: TelegramAlertLevel;
  title: string;
  message: string;
  endpoint?: string;
  createdAt: string;
  telegramReady: boolean;
};

export function createTelegramAlertPayload({
  level,
  title,
  message,
  endpoint,
}: {
  level: TelegramAlertLevel;
  title: string;
  message: string;
  endpoint?: string;
}): TelegramAlertPayload {
  return {
    system: "AI_TRADING_SYSTEM",
    source: "MISSION_CONTROL",
    level,
    title,
    message,
    endpoint,
    createdAt: new Date().toISOString(),
    telegramReady: false,
  };
}
