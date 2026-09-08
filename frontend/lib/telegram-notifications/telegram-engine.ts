import {
  TelegramChannel,
  TelegramChannelConfig,
  TelegramMessage,
  TelegramMessagePriority,
  TelegramNotificationReport,
} from "./telegram-types";

const VERSION = "V17.0.0" as const;

const DEFAULT_CHANNELS: TelegramChannelConfig[] = [
  {
    channel: "TRADES",
    label: "Trades",
    description: "Trade signals, paper orders, executions, position updates",
    chatId: "",
    enabled: false,
    icon: "📈",
  },
  {
    channel: "SECURITY",
    label: "Security Alerts",
    description: "Malwarebytes alerts, kill switch events, intrusion detection",
    chatId: "",
    enabled: false,
    icon: "🛡️",
  },
  {
    channel: "AI_ANALYSIS",
    label: "AI Analysis",
    description: "GPT & Claude insights, risk management updates, forward testing results",
    chatId: "",
    enabled: false,
    icon: "🤖",
  },
  {
    channel: "SYSTEM_HEALTH",
    label: "System Health",
    description: "Health scanner alerts, system errors, update notifications",
    chatId: "",
    enabled: false,
    icon: "⚙️",
  },
];

let _channels: TelegramChannelConfig[] = DEFAULT_CHANNELS.map((c) => ({ ...c }));
let _botToken: string | null = null;
let _recentMessages: TelegramMessage[] = [];

/** Obergrenze der Nachrichtenliste (08.09., Generalkontrolle).
 *
 * Die Liste wurde an VIER Stellen befüllt und an KEINER gekürzt — sie wuchs
 * mit jeder je gesendeten Nachricht. Das ist nicht theoretisch: Telegram
 * bekommt stündliche Tor-Meldungen, jede Trade-Ausführung und die täglichen
 * Reports. Dasselbe Muster wie das Leck in der Brute-Force-Karte (26.08.).
 *
 * Dass nur wenige gebraucht werden, stand schon im Lesepfad: der Bericht gibt
 * `[..._recentMessages].slice(-50)` aus. Gewollt waren also immer 50; 200 ist
 * bewusst grosszügiger, damit auch ein längerer Rückblick möglich bleibt.
 */
export const TELEGRAM_VERLAUF_MAX = 200;

/** Nimmt eine Nachricht in den Verlauf — die EINZIGE Stelle, die schreibt.
 *
 * Vorher stand `_recentMessages.push(msg)` viermal im Code. Eine Obergrenze
 * an drei von vier Stellen wäre keine Obergrenze; deshalb geht das Anhängen
 * jetzt über eine Funktion, und die kürzt. */
function merkeNachricht(msg: TelegramMessage): void {
  _recentMessages.push(msg);
  while (_recentMessages.length > TELEGRAM_VERLAUF_MAX) _recentMessages.shift();
}

/** Nur für Tests und Prüfer. */
export function telegramVerlaufLaenge(): number {
  return _recentMessages.length;
}
export function telegramVerlaufLeeren(): void {
  _recentMessages.length = 0;
}
let _totalSent = 0;
let _totalFailed = 0;

export function getTelegramReport(): TelegramNotificationReport {
  return {
    version: VERSION,
    botConfigured: !!_botToken,
    botToken: _botToken ? `${_botToken.slice(0, 8)}...${_botToken.slice(-4)}` : null,
    channels: _channels.map((c) => ({ ...c })),
    recentMessages: [..._recentMessages].slice(-50),
    totalSent: _totalSent,
    totalFailed: _totalFailed,
    lastMessageAt: _recentMessages.length > 0
      ? _recentMessages[_recentMessages.length - 1].sentAt
      : null,
    simulationMode: !_botToken,
    updatedAt: new Date().toISOString(),
  };
}

export function configureTelegram(botToken: string, channelUpdates: Partial<TelegramChannelConfig>[]): void {
  _botToken = botToken.trim() || null;
  for (const update of channelUpdates) {
    const idx = _channels.findIndex((c) => c.channel === update.channel);
    if (idx >= 0) {
      _channels[idx] = { ..._channels[idx], ...update };
    }
  }
}

export function updateChannelConfig(channel: TelegramChannel, chatId: string, enabled: boolean): void {
  const idx = _channels.findIndex((c) => c.channel === channel);
  if (idx >= 0) {
    _channels[idx] = { ..._channels[idx], chatId, enabled };
  }
}

function buildMessageId() {
  return `TG-${Date.now().toString(36).toUpperCase()}`;
}

export async function sendTelegramMessage(
  channel: TelegramChannel,
  text: string,
  priority: TelegramMessagePriority = "NORMAL",
  source = "System"
): Promise<{ ok: boolean; status: TelegramMessage["status"]; message?: string }> {
  const channelCfg = _channels.find((c) => c.channel === channel);

  if (!channelCfg?.enabled || !channelCfg.chatId) {
    const msg: TelegramMessage = {
      id: buildMessageId(),
      channel,
      priority,
      text,
      sentAt: new Date().toISOString(),
      status: "SIMULATED",
      source,
    };
    merkeNachricht(msg);
    return { ok: true, status: "SIMULATED", message: "Channel not configured — simulated." };
  }

  if (!_botToken) {
    const msg: TelegramMessage = {
      id: buildMessageId(),
      channel,
      priority,
      text,
      sentAt: new Date().toISOString(),
      status: "SIMULATED",
      source,
    };
    merkeNachricht(msg);
    return { ok: true, status: "SIMULATED", message: "No bot token — simulated." };
  }

  try {
    const priorityPrefix = priority === "CRITICAL" ? "🚨 " : priority === "HIGH" ? "⚠️ " : "";
    const fullText = `${priorityPrefix}${channelCfg.icon} <b>[${channelCfg.label}]</b>\n\n${text}`;

    const response = await fetch(
      `https://api.telegram.org/bot${_botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channelCfg.chatId,
          text: fullText,
          parse_mode: "HTML",
        }),
      }
    );

    const data = await response.json();

    if (data.ok) {
      const msg: TelegramMessage = {
        id: buildMessageId(),
        channel,
        priority,
        text,
        sentAt: new Date().toISOString(),
        status: "SENT",
        source,
      };
      merkeNachricht(msg);
      _totalSent++;
      return { ok: true, status: "SENT" };
    } else {
      _totalFailed++;
      const msg: TelegramMessage = {
        id: buildMessageId(),
        channel,
        priority,
        text,
        sentAt: new Date().toISOString(),
        status: "FAILED",
        source,
      };
      merkeNachricht(msg);
      return { ok: false, status: "FAILED", message: data.description };
    }
  } catch {
    _totalFailed++;
    return { ok: false, status: "FAILED", message: "Network error" };
  }
}
