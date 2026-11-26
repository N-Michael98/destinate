import { htmlSicher } from "../html-sicher/html-sicher";
import { lageMelden } from "../redis-lage/redis-lage";
import Anthropic from "@anthropic-ai/sdk";
import { leseSicherheitsereignisse, entferneAnalysierte } from "./security-event-logger";
import { blockIP } from "./ip-blocklist";
import { triggerKillswitch } from "@/lib/killswitch";
import { sendTelegram, telegramZeit } from "@/lib/telegram-notifications/telegram-sender";
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
  /** Woran die Umgehung erkannt wurde (umgehungsLage) — steht im Alarm. */
  umgehungGrund?: string | null;
}): { killswitch: boolean; merkeKoordiniert: boolean; grund: string } {
  if (e.bypassedIP) {
    return {
      killswitch: true, merkeKoordiniert: false,
      grund: `Events von bereits gesperrter IP ${e.bypassedIP} — Block wurde umgangen!`
        + (e.umgehungGrund ? ` (${e.umgehungGrund})` : ""),
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

// ── UMGANGEN HEISST: NACH DER SPERRE (24.11.) ───────────────────────────────
//
// Bis heute galt JEDES Ereignis einer gesperrten IP als "Block umgangen" —
// sofortiger Killswitch. Der Zyklus sperrt aber erst NACH dem Claude-Aufruf
// (Sekunden), und er entfernt nur die gelesenen Ereignisse. Was der Angreifer
// in dieser Zeit schickte, kam regulaer durch, wurde protokolliert und lag im
// NAECHSTEN Zyklus vor — von einer IP, die jetzt gesperrt ist. Ein Nachzuegler,
// keine Umgehung. 24.11.: 02:45 gesperrt, 02:48 Killswitch, kein Handel bis
// zum /reset um 09:43.
//
// Jetzt zaehlt ein Ereignis nur als Umgehung, wenn es SPAETER als die Sperre
// plus Toleranz entstand. Die Toleranz ist hergeleitet, nicht gegriffen: der
// Proxy prueft die Sperre bis zu 800 ms lang (`proxy.ts`, Promise.race) und
// setzt den Zeitstempel des Ereignisses erst DANACH; eine Anfrage, die die
// Sperrliste kurz vor dem Schreiben gelesen hat, traegt also einen Zeitstempel
// bis knapp 1 s nach `blockedAt`. 2 s decken das samt Redis-Latenz.
//
// UNBEKANNT BLEIBT VORSICHTIG: eine unlesbare Sperrzeit oder ein unlesbarer
// Zeitstempel zaehlt WEITER als Umgehung — das bisherige Verhalten. Nur ein
// BELEGTER Nachzuegler loest nicht mehr aus.
//
// Ein echter Durchbruch nach der Sperre loest weiter SOFORT aus. Auch einer,
// den unser eigener Proxy verursacht (Redis langsamer als 800 ms, fail-open):
// das ist eine eigene Entscheidung und hier bewusst NICHT geaendert.
export const UMGEHUNG_TOLERANZ_MS = 2000;

export interface Nachzuegler {
  ip: string;
  anzahl: number;
  /** Abstand des SPAETESTEN Ereignisses zur Sperre in ms: positiv = so viel
   *  VOR der Sperre, negativ = innerhalb der Toleranz danach. */
  letztesVorSperreMs: number;
}

export function umgehungsLage(
  ereignisse: ReadonlyArray<{ ip?: unknown; ts?: unknown }>,
  sperren: ReadonlyMap<string, { gesperrt: boolean; seitMs: number | null }>,
  toleranzMs: number = UMGEHUNG_TOLERANZ_MS,
): { bypassedIP: string | null; grund: string | null; nachzuegler: Nachzuegler[] } {
  let bypassedIP: string | null = null;
  let grund: string | null = null;
  const nach = new Map<string, Nachzuegler>();
  // Eine unbrauchbare Toleranz darf den Riegel nicht oeffnen: dann ohne.
  const tol = Number.isFinite(toleranzMs) && toleranzMs >= 0 ? toleranzMs : 0;
  for (const e of ereignisse) {
    const ip = typeof e.ip === "string" ? e.ip : "";
    const sperre = ip ? sperren.get(ip) : undefined;
    if (!sperre || sperre.gesperrt !== true) continue;
    const seit = sperre.seitMs;
    const ts = e.ts;
    let umgangen = "";
    if (typeof seit !== "number" || !Number.isFinite(seit)) {
      umgangen = "Sperrzeit unlesbar — als Umgehung gewertet";
    } else if (typeof ts !== "number" || !Number.isFinite(ts)) {
      umgangen = "Zeitstempel des Ereignisses unlesbar — als Umgehung gewertet";
    } else if (ts - seit > tol) {
      umgangen = `Ereignis ${((ts - seit) / 1000).toFixed(1)} s NACH der Sperre`;
    } else {
      const n = nach.get(ip) ?? { ip, anzahl: 0, letztesVorSperreMs: Infinity };
      n.anzahl++;
      n.letztesVorSperreMs = Math.min(n.letztesVorSperreMs, seit - ts);
      nach.set(ip, n);
    }
    if (umgangen && bypassedIP === null) {
      bypassedIP = ip;
      grund = umgangen;
    }
  }
  return { bypassedIP, grund, nachzuegler: [...nach.values()] };
}

/**
 * Name der Stelle fuer die Drossel — EINMAL geschrieben, von beiden
 * Aufrufen benutzt. Zwei Schreibweisen waeren zwei Zustaende, und dann
 * verdeckte die eine die andere.
 */
const WD_STELLE = "Sicherheits-Watchdog";

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
    const ergebnis = await watchdogZyklus();
    // Die RUECKKEHR gehoert gemeldet (Regel vom 01.11.), sonst bliebe
    // offen, ob der Ausfall vorbei ist. `lageMelden` gibt nur bei einem
    // WECHSEL true zurueck — ein gesunder Dauerzustand schweigt, und ein
    // gesunder Start ist keine Nachricht (ausgerechnet: der erste Blick
    // auf eine Stelle meldet nur, wenn sie `aus` ist).
    //
    // Und dieser Aufruf ist NICHT nur Kosmetik: ohne ihn bliebe der
    // Zustand auf `aus`, und ein ZWEITER Ausfall innerhalb von 30 Minuten
    // waere gedrosselt — also stumm.
    if (lageMelden(WD_STELLE, "ok")) {
      console.log("[watchdog] \u2705 Lauf wieder erfolgreich — die "
        + "Sicherheitsereignisse werden wieder geprueft.");
    }
    return ergebnis;
  } catch (e) {
    // ── HIER GAB ES KEINEN CATCH (13.11.) ───────────────────────────────
    //
    // `try { … } finally { … }` ohne `catch`: jeder Wurf aus
    // `watchdogZyklus()` propagierte nach aussen, und dort stand
    // `instrumentation.ts:885` mit `.catch(() => {})`. Der
    // Sicherheits-Watchdog konnte also alle 3 Minuten scheitern, ohne eine
    // einzige Zeile zu hinterlassen.
    //
    // Und der Wurf ist erreichbar, nicht theoretisch: `watchdogZyklus`
    // beginnt mit `await leseSicherheitsereignisse()` AUSSERHALB jedes
    // try — ein Redis-Aussetzer genuegt.
    //
    // Gedrosselt, weil der Lauf alle 3 Minuten feuert: ein Dauerausfall
    // waeren sonst 480 Zeilen am Tag. Die Drossel ist die BESTEHENDE
    // (`lageMelden`), keine zweite Fassung — und sie liegt auf `global`,
    // also teilen Schleife und Route denselben Zustand (Regel 28.07.).
    const grund = e instanceof Error ? e.message : String(e);
    if (lageMelden(WD_STELLE, "aus")) {
      console.error(`[watchdog] \u26d4 Lauf ABGEBROCHEN: ${grund} — solange das `
        + `so ist, prueft NIEMAND die Sicherheitsereignisse: kein `
        + `ATTACK-Alarm, keine IP-Sperre, kein Killswitch aus dieser Quelle.`);
    }
    // `uebersprungen` ist die BESTEHENDE Form fuer "hat nicht gelaufen"
    // (`WatchdogLauf` kennt sie), der Rueckgabetyp aendert sich also nicht.
    // Ein Wurf nach aussen waere die Alternative — dann waere der Fehler
    // wieder nur so sichtbar, wie der Aufrufer ihn behandelt.
    return { uebersprungen: true, grund: `Fehler: ${grund}` };
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

  // EIN UNLESBARER ZEITSTEMPEL BRACH DEN GANZEN ZYKLUS AB (24.11.). Hier stand
  // `new Date(e.ts).toISOString()` — das WIRFT bei einer ungueltigen Zeit, und
  // zwar AUSSERHALB des try. Der Zyklus endete im catch von runClaudeWatchdog,
  // die Ereignisse wurden nicht entfernt, und der naechste Zyklus scheiterte
  // an derselben Zeile — bis die Liste ablief (jedes neue Ereignis verlaengert
  // ihre Lebensdauer). Ueber den Proxy nicht erreichbar (er setzt `ts: now`),
  // aber die Liste kommt aus Redis und wird hier nur geparst, nicht geprueft.
  // Gefunden vom Pruefstand der Umgehungs-Pruefung. Ebenso `payload`: eine
  // Nicht-Zeichenkette haette `.slice` werfen lassen. Und `Number.isFinite`
  // allein reicht nicht: `new Date(1e20)` ist ungueltig, obwohl 1e20 endlich ist.
  const zeitText = (ts: unknown): string => {
    const d = typeof ts === "number" ? new Date(ts) : null;
    return d && Number.isFinite(d.getTime()) ? d.toISOString() : "Zeit unlesbar";
  };
  const eventSummary = events
    .slice(0, 50) // cap to keep prompt small
    .map((e) => `[${zeitText(e.ts)}] ${e.type} | IP: ${e.ip} | Path: ${e.path}${e.payload ? ` | Payload: ${String(e.payload).slice(0, 80)}` : ""}`)
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
      // ENTSCHAERFT AN DER QUELLE (01.11.). `parsed.summary` ist ein von
      // der KI geschriebener Satz und geht in fuenf Telegram-Alarme, die
      // mit `parse_mode: "HTML"` rausgehen. Ein `<` oder `&` darin liess
      // Telegram die GANZE Nachricht ablehnen — beim Watchdog waere das
      // der Sicherheitsalarm selbst. `sendTelegram` faengt das seit heute
      // zusaetzlich an der Grenze ab, aber dann ohne Formatierung.
      summary: htmlSicher(parsed.summary),
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
🕐 ${telegramZeit()}

<i>Falls dies ein echter Angriff ist: /untrust ${attackIP} dann /block ${attackIP}</i>`
        );
      } else {
        // ── Eskalations-Doppel-Check VOR dem Blocken ─────────────────────────
        // Die Middleware weist gesperrte IPs ab BEVOR Events geloggt werden —
        // aber erst, SOBALD die Sperre steht. Ein Ereignis von einer jetzt
        // gesperrten IP ist deshalb nur dann eine Umgehung, wenn es NACH der
        // Sperre entstand (umgehungsLage, 24.11.); davor ist es ein Nachzuegler
        // aus dem letzten Zyklus. Viele verschiedene IPs = koordiniert — seit
        // 15.09. erst beim ZWEITEN solchen Zyklus in Folge.
        const { sperrZeiten } = await import("./ip-blocklist");
        const sperren = await sperrZeiten([...ipCounts.keys()]);
        const umgehung = umgehungsLage(events, sperren);
        const bypassedIP = umgehung.bypassedIP;
        const distinctIPs = ipCounts.size;
        // Nachzuegler werden GENANNT, nicht still verworfen: sonst waere
        // "keine Umgehung" von "nicht geprueft" nicht zu unterscheiden.
        // Gedeckelt: bis zu 200 IPs je Zyklus, und der Text geht in einen
        // Telegram-Alarm (4096 Zeichen). Der Rest wird gezaehlt, nicht verschwiegen.
        const NACHZUEGLER_MAX = 5;
        const nachzueglerText = umgehung.nachzuegler.slice(0, NACHZUEGLER_MAX).map((n) =>
          `${n.ip.slice(0, 45)} ${n.anzahl}× (spaetestes ${(n.letztesVorSperreMs / 1000).toFixed(1)} s vor der Sperre)`).join(", ")
          + (umgehung.nachzuegler.length > NACHZUEGLER_MAX
            ? ` +${umgehung.nachzuegler.length - NACHZUEGLER_MAX} weitere IPs` : "");
        if (nachzueglerText) {
          console.log(`[watchdog] ℹ️ Nachzuegler von gesperrten IPs — VOR der Sperre protokolliert, keine Umgehung: ${nachzueglerText}`);
        }

        if (attackIP) await blockIP(attackIP, `ATTACK: ${result.summary}`, true); // permanent

        const vorher = await cacheGet<number>(KOORDINIERT_SCHLUESSEL).catch(() => null);
        const entscheidung = eskalationsEntscheidung({
          bypassedIP,
          distinctIPs,
          vorherKoordiniertAm: typeof vorher === "number" ? vorher : null,
          jetzt: Date.now(),
          umgehungGrund: umgehung.grund,
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
Events analyzed: ${result.eventCount}${nachzueglerText ? `\nℹ️ Nachzügler (VOR der Sperre protokolliert, keine Umgehung): ${htmlSicher(nachzueglerText)}` : ""}

✅ <b>Trading läuft weiter.</b>
<i>Sieht der nächste Zyklus (in ~3 min) wieder so aus, löst der Killswitch aus.
Einzelne Scanner-Wellen stoppen den Handel damit nicht mehr.</i>
🕐 ${telegramZeit()}`
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
Events analyzed: ${result.eventCount}${nachzueglerText ? `\nℹ️ Nachzügler (VOR der Sperre protokolliert, keine Umgehung): ${htmlSicher(nachzueglerText)}` : ""}

✅ <b>Trading läuft normal weiter</b> — Angreifer ist ausgesperrt.
<i>Killswitch nur bei Eskalation (Block umgangen, oder ≥5 IPs in zwei Zyklen in Folge).</i>
🕐 ${telegramZeit()}`
          );
        }
      }
    } else {
      // SAFE oder SUSPICIOUS: kein koordinierter Angriff in diesem Zyklus.
      await koordiniertVergessen();
    }

    if (result.verdict === "SUSPICIOUS") {
      // Bei SUSPICIOUS: IP blockieren ab 5 Events (72h) — ausser whitelisted.
      // 26.11.: die Meldung sagt „AUTO-GEBLOCKT" nur, wenn die Sperre auch
      // VERSUCHT wurde. Vorher stand es bei >= 5 Events auch fuer eine IP auf
      // der Whitelist da, die nie gesperrt wird — eine Meldung, die etwas
      // behauptet, das der Code nicht tut (Klasse 27.09.).
      let gesperrt = false;
      if (topIP && topIP[1] >= 5) {
        const { isIPWhitelisted } = await import("./ip-blocklist");
        const trusted = await isIPWhitelisted(topIP[0]);
        if (!trusted) {
          await blockIP(topIP[0], `SUSPICIOUS (${topIP[1]} Events): ${result.summary}`, false);
          gesperrt = true;
        }
      }
      await sendTelegram(
`⚠️ <b>Security Watchdog — SUSPICIOUS</b>

${result.summary}
${topIP ? `🔍 Haupt-IP: <code>${topIP[0]}</code> (${topIP[1]} Events)${gesperrt ? " — <b>AUTO-GEBLOCKT 72h</b>" : topIP[1] >= 5 ? " — auf der Whitelist, NICHT gesperrt" : ""}` : ""}
Events in window: ${result.eventCount}
🕐 ${telegramZeit()}

<i>Diese Meldung stoppt den Handel nicht. Killswitch nur bei Eskalation (Block umgangen, oder ≥5 IPs in zwei Zyklen in Folge) — ein einzelner Scanner löst ihn nie aus.</i>`
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

🕐 ${telegramZeit()}

To restart after investigation: /reset (Passwort erforderlich)`
  ).catch(() => {}); // never let telegram failure prevent killswitch
}
