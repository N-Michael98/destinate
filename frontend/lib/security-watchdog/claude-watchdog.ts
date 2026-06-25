import Anthropic from "@anthropic-ai/sdk";
import { getSecurityEvents, clearSecurityEvents } from "./security-event-logger";
import { blockIP } from "./ip-blocklist";
import { triggerKillswitch } from "@/lib/killswitch";
import { sendTelegram } from "@/lib/telegram-notifications/telegram-sender";

type WatchdogVerdict = "SAFE" | "SUSPICIOUS" | "ATTACK";

interface WatchdogResult {
  verdict: WatchdogVerdict;
  summary: string;
  eventCount: number;
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in Railway environment variables");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function runClaudeWatchdog(): Promise<WatchdogResult | null> {
  const events = await getSecurityEvents();

  console.log(`[watchdog] Cycle start — ${events.length} events in Redis`);

  if (events.length === 0) {
    console.log("[watchdog] No events — SAFE (skipping Claude call)");
    return { verdict: "SAFE", summary: "No security events recorded.", eventCount: 0 };
  }

  const eventSummary = events
    .slice(0, 50) // cap to keep prompt small
    .map((e) => `[${new Date(e.ts).toISOString()}] ${e.type} | IP: ${e.ip} | Path: ${e.path}${e.payload ? ` | Payload: ${e.payload.slice(0, 80)}` : ""}`)
    .join("\n");

  const prompt = `You are a security analyst for a live AI trading system.
Analyze the following HTTP security events from the past 3 minutes and return a verdict.

EVENTS:
${eventSummary}

Return a JSON object with exactly these fields:
{
  "verdict": "SAFE" | "SUSPICIOUS" | "ATTACK",
  "summary": "<one sentence describing what you found>"
}

SAFE = normal noise, no real threat
SUSPICIOUS = unusual patterns worth watching but not an active attack
ATTACK = active exploit attempt, credential stuffing, injection attacks, or coordinated honeypot probing

Respond ONLY with the JSON object, nothing else.`;

  try {
    const client = getClient();
    const stream = await client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 256,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    const msg = await stream.finalMessage();
    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.warn("[watchdog] No text block in Claude response");
      return null;
    }

    // Extract JSON from response (strip markdown fences if any)
    const raw = textBlock.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw) as { verdict: WatchdogVerdict; summary: string };

    const result: WatchdogResult = {
      verdict: parsed.verdict,
      summary: parsed.summary,
      eventCount: events.length,
    };

    console.log(`[watchdog] Verdict: ${result.verdict} — ${result.summary} (${events.length} events)`);

    // Häufigste angreifende IP ermitteln
    const ipCounts = new Map<string, number>();
    for (const e of events) {
      if (e.ip && e.ip !== "unknown") ipCounts.set(e.ip, (ipCounts.get(e.ip) ?? 0) + 1);
    }
    const topIP = [...ipCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    if (result.verdict === "ATTACK") {
      if (topIP) await blockIP(topIP[0], `ATTACK: ${result.summary}`, true); // permanent
      await handleAttack(result, topIP?.[0]);
    } else if (result.verdict === "SUSPICIOUS") {
      // Bei SUSPICIOUS: IP blockieren wenn sie > 5 Events hat (72h)
      if (topIP && topIP[1] >= 5) {
        await blockIP(topIP[0], `SUSPICIOUS (${topIP[1]} Events): ${result.summary}`, false);
      }
      await sendTelegram(
`⚠️ <b>Security Watchdog — SUSPICIOUS</b>

${result.summary}
${topIP ? `🔍 Haupt-IP: <code>${topIP[0]}</code> (${topIP[1]} Events)${topIP[1] >= 5 ? " — <b>AUTO-GEBLOCKT 72h</b>" : ""}` : ""}
Events in window: ${result.eventCount}
🕐 ${new Date().toLocaleString("de-CH")}

<i>Watching closely. If escalates, auto-killswitch will trigger.</i>`
      );
    }

    // Clear events after analysis so next cycle starts fresh
    await clearSecurityEvents();

    return result;
  } catch (err) {
    console.error("[watchdog] Claude API error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function handleAttack(result: WatchdogResult, blockedIP?: string): Promise<void> {
  console.error(`[watchdog] 🚨 ATTACK DETECTED — triggering killswitch`);

  // 1. Trigger killswitch immediately
  triggerKillswitch("AI_WATCHDOG", "Claude Security Watchdog");

  // 2. Alert via Telegram
  await sendTelegram(
`🚨 <b>SECURITY WATCHDOG — ATTACK DETECTED</b>

${result.summary}
${blockedIP ? `🚫 IP AUTO-GEBLOCKT: <code>${blockedIP}</code> (PERMANENT)` : ""}
Events analyzed: ${result.eventCount}

⚡ <b>AUTO-KILLSWITCH TRIGGERED</b>
• All broker connections severed
• Trading execution blocked
• System locked down

🕐 ${new Date().toLocaleString("de-CH")}

To restart after investigation: /reset (Passwort erforderlich)`
  ).catch(() => {}); // never let telegram failure prevent killswitch
}
