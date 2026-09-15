import Anthropic from "@anthropic-ai/sdk";
import { leseSicherheitsereignisse, entferneAnalysierte } from "./security-event-logger";
import { blockIP } from "./ip-blocklist";
import { triggerKillswitch } from "@/lib/killswitch";
import { sendTelegram } from "@/lib/telegram-notifications/telegram-sender";
import { meldeAIGateAusfall } from "@/lib/ai-gate/ai-gate-alert";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache/redis-cache";

type WatchdogVerdict = "SAFE" | "SUSPICIOUS" | "ATTACK";

interface WatchdogResult {
  verdict: WatchdogVerdict;
  summary: string;
  eventCount: number;
}

/** Ergebnis eines Aufrufs. `null` heisst: NICHT beurteilt (Ausfall, gemeldet).
 *  `uebersprungen` heisst: ein vorheriger Lauf war noch aktiv — kein Ausfall. */
export type WatchdogLauf = WatchdogResult | null | { uebersprungen: true; grund: string };

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in Railway environment variables");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ── KEINE UEBERLAPPENDEN LAEUFE (15.09.) ─────────────────────────────────────
//
// Der Watchdog laeuft alle 3 Minuten (instrumentation.ts), der Claude-Client
// hat keinen eigenen Timeout — Standard des SDK sind 10 MINUTEN plus
// Wiederholungen (nachgelesen in @anthropic-ai/sdk/client.js). Haengt die API,
// stapeln sich die Laeufe; jeder liest dieselben Ereignisse, jeder kann
// blocken, telegrafieren und den Killswitch ausloesen.
//
// Nach 15 Minuten gilt ein Lauf als haengend und ein neuer darf starten — eine
// Sperre, die nie aufgeht, schaltete den Watchdog still und fuer immer ab.
export const WATCHDOG_HAENGER_MS = 15 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __watchdog_laeuft_seit__: number | null | undefined;
}

/** Darf ein neuer Lauf starten? Reine Rechnung, damit der Pruefer sie aufrufen kann.
 *
 *  Im Zweifel STARTEN: ein unlesbarer Zeitstempel oder eine rueckwaerts
 *  laufende Uhr darf den Watchdog nicht dauerhaft blockieren. */
export function watchdogDarfStarten(
  laeuftSeit: number | null | undefined,
  jetzt: number,
): { starten: boolean; grund: string } {
  if (laeuftSeit === null || laeuftSeit === undefined) return { starten: true, grund: "frei" };
  if (!Number.isFinite(laeuftSeit) || !Number.isFinite(jetzt)) {
    return { starten: true, grund: "Sperr-Zeitstempel unlesbar — Lauf startet" };
  }
  const dauer = jetzt - laeuftSeit;
  if (dauer < 0) return { starten: true, grund: "Uhr lief rueckwaerts — Lauf startet" };
  if (dauer < WATCHDOG_HAENGER_MS) {
    return { starten: false, grund: `vorheriger Lauf seit ${Math.round(dauer / 1000)} s aktiv — dieser Zyklus wird uebersprungen` };
  }
  return { starten: true, grund: `vorheriger Lauf haengt seit ${Math.round(dauer / 60000)} min — neuer Lauf startet` };
}

// ── ESKALATION: KILLSWITCH ERST BEIM ZWEITEN KOORDINIERTEN ZYKLUS (15.09.) ───
//
// Entscheidung des Nutzers. Bis heute: "ATTACK und >= 5 verschiedene IPs ->
// Killswitch". Diese Regel stand neben einem Speicher, der gleichzeitige
// Ereignisse verlor (20 IPs -> 1 gespeichert). Der Verlust hat die Regel also
// vermutlich ZUFAELLIG entschaerft. Ein oeffentlicher Server wird von vielen
// Scannern gleichzeitig abgeklopft, und der Prompt nennt "coordinated
// honeypot probing" ausdruecklich ATTACK. Mit vollstaendigem Speicher haette
// jede Scanner-Welle den Handel stoppen koennen.
//
// JETZT:
//   - Block umgangen (Ereignis von bereits gesperrter IP) -> SOFORT Killswitch.
//     Das ist kein Laerm, das ist ein Angreifer, der die Sperre ueberwindet.
//   - >= 5 IPs im ERSTEN Zyklus -> blocken, melden, merken. Kein Killswitch.
//   - >= 5 IPs auch im NAECHSTEN Zyklus (innerhalb von 10 Minuten) -> Killswitch.
//   - Ein Zyklus ohne koordinierten Angriff dazwischen setzt die Zaehlung zurueck.
export const KOORDINIERT_FENSTER_MS = 10 * 60 * 1000;
const KOORDINIERT_SCHLUESSEL = "watchdog:koordiniert_am";

export function eskalationsEntscheidung(e: {
  bypassedIP: string | null;
  distinctIPs: number;
  vorherKoordiniertAm: number | null;
  jetzt: number;
}): { killswitch: boolean; merkeKoordiniert: boolean; grund: string } {
  if (e.bypassedIP) {
    return {
      killswitch: true, merkeKoordiniert: false,
      grund: `Events von bereits gesperrter IP ${e.bypassedIP} — Block wurde umgangen!`,
    };
  }
  if (!(e.distinctIPs >= 5)) {
    return { killswitch: false, merkeKoordiniert: false, grund: "Einzel-IP, Block greift" };
  }
  const vorher = e.vorherKoordiniertAm;
  // Eine rueckwaerts laufende Uhr zaehlt NICHT als "in Folge": wegen eines
  // Uhrenfehlers soll der Handel nicht stoppen. Der erste Zyklus blockt und
  // meldet ohnehin.
  const folgt = vorher !== null
    && Number.isFinite(vorher) && Number.isFinite(e.jetzt)
    && e.jetzt - vorher >= 0
    && e.jetzt - vorher <= KOORDINIERT_FENSTER_MS;
  if (folgt) {
    return {
      killswitch: true, merkeKoordiniert: false,
      grund: `Koordinierter Angriff im zweiten Zyklus in Folge: ${e.distinctIPs} verschiedene IPs`,
    };
  }
  return {
    killswitch: false, merkeKoordiniert: true,
    grund: `Koordiniert (${e.distinctIPs} verschiedene IPs), erster Zyklus — Killswitch erst bei Wiederholung`,
  };
}

async function koordiniertVergessen(): Promise<void> {
  await cacheDel(KOORDINIERT_SCHLUESSEL).catch(() => {});
}

export async function runClaudeWatchdog(): Promise<WatchdogLauf> {
  const jetzt = Date.now();
  const darf = watchdogDarfStarten(global.__watchdog_laeuft_seit__, jetzt);
  if (!darf.starten) {
    console.warn(`[watchdog] ${darf.grund}`);
    return { uebersprungen: true, grund: darf.grund };
  }
  if (darf.grund !== "frei") console.warn(`[watchdog] ${darf.grund}`);

  // Eigenes Kennzeichen je Lauf: beendet sich ein haengender Lauf spaeter doch
  // noch, darf er die Sperre des NEUEN Laufs nicht freigeben.
  const kennung = jetzt;
  global.__watchdog_laeuft_seit__ = kennung;
  try {
    return await watchdogZyklus();
  } finally {
    if (global.__watchdog_laeuft_seit__ === kennung) global.__watchdog_laeuft_seit__ = null;
  }
}

async function watchdogZyklus(): Promise<WatchdogResult | null> {
  const { ereignisse: events, roh } = await leseSicherheitsereignisse();

  console.log(`[watchdog] Cycle start — ${events.length} events in Redis`);

  if (events.length === 0) {
    console.log("[watchdog] No events — SAFE (skipping Claude call)");
    // Ein ruhiger Zyklus unterbricht "zwei koordinierte in Folge".
    await koordiniertVergessen();
    // Unlesbare Reste ohne gueltiges Ereignis trotzdem abraeumen.
    if (roh.length > 0) await entferneAnalysierte(roh);
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const msg = await stream.finalMessage();
    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.warn("[watchdog] No text block in Claude response");
      // ZWEITER stiller Ausgang, derselbe Ausgang (08.09.). Auch hier wurde
      // nicht beurteilt — die Folge ist dieselbe wie im catch unten: keine
      // Eskalation, kein Killswitch. Nur den einen Weg zu melden hiesse, den
      // anderen weiterhin zu verschweigen.
      await meldeAIGateAusfall("Watchdog", new Error("Antwort ohne Textblock"));
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
      // Whitelist-Check: whitelisted IPs werden nie automatisch geblockt/killswitch
      const { isIPWhitelisted } = await import("./ip-blocklist");
      const attackIP = topIP?.[0];
      const trusted = attackIP ? await isIPWhitelisted(attackIP) : false;
      if (trusted) {
        await koordiniertVergessen();
        console.log(`[watchdog] ⚠️ ATTACK von vertrauenswürdiger IP ${attackIP} — kein Auto-Block/Killswitch`);
        await sendTelegram(
`⚠️ <b>Security Watchdog — ATTACK von vertrauenswürdiger IP</b>

${result.summary}
🔵 IP <code>${attackIP}</code> ist auf der Whitelist — kein Auto-Block.
Events analyzed: ${result.eventCount}
🕐 ${new Date().toLocaleString("de-CH")}

<i>Falls dies ein echter Angriff ist: /untrust ${attackIP} dann /block ${attackIP}</i>`
        );
      } else {
        // ── Eskalations-Doppel-Check VOR dem Blocken ─────────────────────────
        // Die Middleware weist gesperrte IPs ab BEVOR Events geloggt werden.
        // Events von einer bereits gesperrten IP = Block wurde umgangen = echte
        // Eskalation. Viele verschiedene IPs = koordiniert — seit 15.09. aber
        // erst beim ZWEITEN solchen Zyklus in Folge (eskalationsEntscheidung).
        const { isIPBlocked } = await import("./ip-blocklist");
        let bypassedIP: string | null = null;
        for (const ip of ipCounts.keys()) {
          if (await isIPBlocked(ip)) { bypassedIP = ip; break; }
        }
        const distinctIPs = ipCounts.size;

        if (attackIP) await blockIP(attackIP, `ATTACK: ${result.summary}`, true); // permanent

        const vorher = await cacheGet<number>(KOORDINIERT_SCHLUESSEL).catch(() => null);
        const entscheidung = eskalationsEntscheidung({
          bypassedIP,
          distinctIPs,
          vorherKoordiniertAm: typeof vorher === "number" ? vorher : null,
          jetzt: Date.now(),
        });

        if (entscheidung.killswitch) {
          await koordiniertVergessen();
          await handleAttack(result, attackIP, entscheidung.grund);
        } else if (entscheidung.merkeKoordiniert) {
          await cacheSet(KOORDINIERT_SCHLUESSEL, Date.now(), Math.ceil(KOORDINIERT_FENSTER_MS / 1000) + 300);
          console.warn(`[watchdog] ⚠️ ${entscheidung.grund} — Haupt-IP ${attackIP ?? "?"} geblockt`);
          await sendTelegram(
`⚠️ <b>Security Watchdog — KOORDINIERTER ANGRIFF (1. Zyklus)</b>

${result.summary}
🌐 ${distinctIPs} verschiedene IPs gleichzeitig
${attackIP ? `🚫 Haupt-IP AUTO-GEBLOCKT: <code>${attackIP}</code> (PERMANENT)` : ""}
Events analyzed: ${result.eventCount}

✅ <b>Trading läuft weiter.</b>
<i>Sieht der nächste Zyklus (in ~3 min) wieder so aus, löst der Killswitch aus.
Einzelne Scanner-Wellen stoppen den Handel damit nicht mehr.</i>
🕐 ${new Date().toLocaleString("de-CH")}`
          );
        } else {
          await koordiniertVergessen();
          // Standard-Fall (Scanner-Bot): Block + Alarm reichen — Trading läuft weiter.
          // Ein einzelner, sofort gesperrter Bot darf das Trading nicht mehr stoppen.
          console.log(`[watchdog] 🚫 ATTACK geblockt (${attackIP}) — kein Killswitch (Einzel-IP, Block greift)`);
          await sendTelegram(
`🚫 <b>Security Watchdog — ANGRIFF GEBLOCKT</b>

${result.summary}
🚫 IP AUTO-GEBLOCKT: <code>${attackIP}</code> (PERMANENT)
Events analyzed: ${result.eventCount}

✅ <b>Trading läuft normal weiter</b> — Angreifer ist ausgesperrt.
<i>Killswitch nur bei Eskalation (Block umgangen, oder ≥5 IPs in zwei Zyklen in Folge).</i>
🕐 ${new Date().toLocaleString("de-CH")}`
          );
        }
      }
    } else {
      // SAFE oder SUSPICIOUS: kein koordinierter Angriff in diesem Zyklus.
      await koordiniertVergessen();
    }

    if (result.verdict === "SUSPICIOUS") {
      // Bei SUSPICIOUS: IP blockieren wenn sie > 5 Events hat (72h) — ausser whitelisted
      if (topIP && topIP[1] >= 5) {
        const { isIPWhitelisted } = await import("./ip-blocklist");
        const trusted = await isIPWhitelisted(topIP[0]);
        if (!trusted) {
          await blockIP(topIP[0], `SUSPICIOUS (${topIP[1]} Events): ${result.summary}`, false);
        }
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

    // GENAU die analysierten Ereignisse entfernen (15.09.). Hier stand
    // `clearSecurityEvents()`, das die Liste auf `[]` setzte — und damit auch
    // alles loeschte, was waehrend des Claude-Aufrufs eingetroffen war.
    await entferneAnalysierte(roh);

    return result;
  } catch (err) {
    console.error("[watchdog] Claude API error:", err instanceof Error ? err.message : String(err));
    // MELDEN — hier wiegt das Schweigen am schwersten (08.09.).
    //
    // Dieser Rückgabewert `null` heisst: die Sicherheitsereignisse wurden NICHT
    // beurteilt. Damit kann `handleAttack()` nicht laufen, und der automatische
    // Killswitch bei einem Angriff LÖST NICHT AUS. Genau das lief am 08.09. den
    // ganzen Tag (leeres Anthropic-Guthaben), ohne dass es irgendwo ausser in
    // der Serverkonsole stand.
    //
    // Die Ereignisse bleiben erhalten: `entferneAnalysierte()` steht im
    // try-Zweig VOR diesem catch und läuft bei einem Ausfall nicht. Der nächste
    // erfolgreiche Zyklus sieht sie also noch.
    await meldeAIGateAusfall("Watchdog", err);
    return null;
  }
}

async function handleAttack(result: WatchdogResult, blockedIP?: string, escalation?: string): Promise<void> {
  console.error(`[watchdog] 🚨 ESKALATION — triggering killswitch: ${escalation ?? "unbekannt"}`);

  // 1. Trigger killswitch immediately
  triggerKillswitch("AI_WATCHDOG", "Claude Security Watchdog");

  // 2. Alert via Telegram
  await sendTelegram(
`🚨 <b>SECURITY WATCHDOG — ESKALATION</b>

${result.summary}
${escalation ? `⚠️ Eskalationsgrund: ${escalation}` : ""}
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
