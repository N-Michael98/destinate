/**
 * RiskAgent — Zuständig für Breakeven, Trailing Stop und Partial TP
 *
 * Eigener AI Manager (Claude) bewertet jede Position und entscheidet:
 * - Soll BE jetzt gesetzt werden?
 * - Soll Trail angepasst werden?
 * - Soll Partial TP ausgelöst werden?
 *
 * Kommuniziert via Agent Bus mit anderen Agents.
 */

import Anthropic from "@anthropic-ai/sdk";
import { agentBus } from "./agent-bus";
import { meldeAIEntscheidung } from "./ai-manager-status";
import {
  capitalUpdatePosition,
  capitalClosePosition,
  capitalClosePartial,
  EPIC_MAP,
  type OpenPosition,
} from "../capital-com/capital-com-client";

const AGENT_ID = "RiskAgent";

// ── Typen ─────────────────────────────────────────────────────────────────────

export type LivePosition = OpenPosition;

export interface PosMeta {
  beSet: boolean;
  partialDone: boolean;
  trailSL: number | null;
  peakPrice: number | null;
  confidence: number;
  tradingStyle: string;
  /** Letzter Eingriff eines ANDEREN Systems an derselben Position (11.08.).
   *  Optional, damit bestehende Aufrufer unveraendert bleiben. */
  fremdAktion?: { zeit: string; text: string } | null;
  /** true = tradingStyle und confidence stammen NICHT aus Datenbank oder
   *  Speicher, sondern sind die Standardwerte (DAYTRADING, 72) — also geraten
   *  (19.08.). Der Zeit-Exit darf darauf nicht handeln. Optional, damit
   *  bestehende Aufrufer unveraendert bleiben. */
  stilGeraten?: boolean;
}

export interface PriceData {
  bid: number;
  ask: number;
}

export interface RiskAgentContext {
  apiKey: string;
  cst: string;
  securityToken: string;
  positions: LivePosition[];
  priceMap: Map<string, PriceData>;
  dbMeta: Map<string, PosMeta>;
  atrMap: Map<string, number>;
  /** Stufe 2 (10.08.): Ausstiegs-Schwellen relativ zum Stop.
   *  Fehlt das Feld, gelten die festen Kursprozente wie bisher — der
   *  Aufrufer muss also nichts tun, damit sich nichts ändert. */
  exitSchwellen?: ExitSchwellenEinstellung;
}

// ── Konfiguration ─────────────────────────────────────────────────────────────

const DEFAULT_SL_RANGE: Record<string, number> = {
  XAUUSD: 10,   XAGUSD: 0.5,
  EURUSD: 0.003, GBPUSD: 0.003, USDJPY: 0.3, AUDUSD: 0.003,
  USDCAD: 0.003, USDCHF: 0.003, GBPJPY: 0.3, EURJPY: 0.3,
  EURGBP: 0.003, NZDUSD: 0.003,
  NAS100: 50, SPX500: 20, UK100: 30, GER40: 40, DJ30: 50, JPN225: 200,
  USOIL: 1.0, UKOIL: 1.0, NATGAS: 0.1,
  BTCUSD: 500, ETHUSD: 30,
};

const BE_TOLERANCE: Record<string, number> = {
  XAUUSD: 0.5,   XAGUSD: 0.02,
  EURUSD: 0.0002, GBPUSD: 0.0002, USDJPY: 0.02, AUDUSD: 0.0002,
  USDCAD: 0.0002, USDCHF: 0.0002, GBPJPY: 0.02, EURJPY: 0.02,
  EURGBP: 0.0002, NZDUSD: 0.0002,
  NAS100: 2, SPX500: 1, UK100: 1, GER40: 2, DJ30: 5, JPN225: 10,
  USOIL: 0.05, UKOIL: 0.05, NATGAS: 0.005,
  BTCUSD: 10, ETHUSD: 1,
};

const STYLE_MAX_HOURS: Record<string, number> = {
  SCALPING: 4, DAYTRADING: 24, SWING: 168,
};

// Profit-%-Schwellen + ATR-Faktor nach Trading-Style
function getStyleThresholds(style: string): {
  bePct: number; partialPct: number; trailPct: number; atrFactor: number;
} {
  switch (style.toUpperCase()) {
    case "SCALPING":  return { bePct: 0.003, partialPct: 0.006, trailPct: 0.010, atrFactor: 1.0 };
    case "SWING":     return { bePct: 0.010, partialPct: 0.020, trailPct: 0.030, atrFactor: 2.5 };
    default:          return { bePct: 0.005, partialPct: 0.010, trailPct: 0.015, atrFactor: 1.5 };
  }
}

// ── In-Memory State ───────────────────────────────────────────────────────────

const positionMeta: Map<string, PosMeta> = new Map();

/**
 * Persistiert Risiko-Zustand in Trade.notes (Generalkontroll-Fund 28.07.).
 *
 * Vorher lebten beSet/partialDone/trailSL NUR in der obigen Map — die ist nach
 * jedem Redeploy/Neustart leer. active-trade-manager.ts LIEST zwar
 * dbMeta.partialDone aus notes, aber niemand hat es je GESCHRIEBEN. Folge:
 * nach einem Neustart galt "Teilgewinn noch nicht genommen" und der RiskAgent
 * hat bei weiterhin >= Schwelle ein ZWEITES Mal 50% geschlossen.
 * (Breakeven/Trailing waren nie betroffen — die prüfen zusätzlich den echten
 * Stop beim Broker über alreadyAtBE bzw. meta.trailSL ?? liveSL.)
 *
 * Merged NUR die übergebenen Felder in das bestehende notes-JSON — entryContext,
 * dealId, Slippage-Daten usw. bleiben unangetastet. Fire-and-forget + non-fatal:
 * ein DB-Problem darf den Trading-Zyklus niemals blockieren oder abbrechen.
 * "updatedAt" wird bewusst NICHT angefasst (Report-Zeiträume bleiben korrekt).
 */
function persistMeta(dealId: string, patch: Record<string, unknown>): void {
  (async () => {
    try {
      const { getPrisma } = await import("../../app/lib/prisma");
      const db = getPrisma();
      const rows = await (db.$queryRawUnsafe as (q: string, ...a: unknown[]) => Promise<Array<{ id: number; notes: string }>>)(
        `SELECT id, notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE $1 LIMIT 1`,
        `%"dealId":"${dealId}"%`
      );
      if (!rows?.length) return;
      let m: Record<string, unknown> = {};
      try { m = JSON.parse(rows[0].notes) as Record<string, unknown>; } catch { m = {}; }
      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "notes" = $1 WHERE "id" = $2`,
        JSON.stringify({ ...m, ...patch }),
        rows[0].id
      );
    } catch (e) {
      console.warn(`[risk-agent] Risiko-Zustand nicht persistiert (deal=${dealId}):`, e instanceof Error ? e.message : String(e));
    }
  })();
}

/**
 * Hält eine AI-Entscheidung bei der Position fest (11.08.).
 *
 * WOZU. Der Grund der AI (aiReason) ging bisher in eine Logzeile und in eine
 * Event-Nutzlast — und wurde von NIEMANDEM gelesen. Der Diagnostics-Agent ist
 * einziger Zuhörer am Bus und wertet ihn nicht aus. Damit gab es keine
 * Rückkopplung: niemand konnte messen, ob ein SKIP oder ein ADJUST sich
 * gelohnt hat. Die AI durfte entscheiden, ohne dass ihre Entscheidungen je
 * nachgerechnet wurden.
 *
 * Jetzt landen sie in Trade.notes, neben dem Ausstiegsgrund. Damit stehen
 * Entscheidung und Ergebnis in derselben Zeile, und die Analysis-Engine kann
 * beides gruppieren (aiEntscheidungen im Wochenreport).
 *
 * ZWEI FELDER MIT ABSICHT:
 *   aiZusammenfassung  Zähler je Ausgang — überlebt die Deckelung und ist das,
 *                      worauf ausgewertet wird
 *   aiEntscheidungen   die letzten 10 im Klartext, zum Nachlesen im Einzelfall
 *
 * Ohne Deckelung würde TRAIL das Feld fluten: Breakeven und Teilgewinn fallen
 * je einmal an, ein Trailing-Stop kann sich dutzende Male bewegen.
 */
function merkeAIEntscheidung(
  dealId: string,
  massnahme: "BREAKEVEN" | "TRAIL" | "PARTIAL_TP",
  aktion: "APPROVE" | "SKIP" | "ADJUST",
  grund: string,
): void {
  (async () => {
    try {
      const { getPrisma } = await import("../../app/lib/prisma");
      const db = getPrisma();
      const rows = await (db.$queryRawUnsafe as (q: string, ...a: unknown[]) => Promise<Array<{ id: number; notes: string }>>)(
        `SELECT id, notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE $1 LIMIT 1`,
        `%"dealId":"${dealId}"%`
      );
      if (!rows?.length) return;
      let m: Record<string, unknown> = {};
      try { m = JSON.parse(rows[0].notes) as Record<string, unknown>; } catch { m = {}; }

      const bisher = Array.isArray(m.aiEntscheidungen)
        ? (m.aiEntscheidungen as unknown[]).slice(-9)
        : [];
      const zaehler = (typeof m.aiZusammenfassung === "object" && m.aiZusammenfassung !== null
        ? m.aiZusammenfassung
        : {}) as Record<string, number>;
      zaehler[aktion] = (Number(zaehler[aktion]) || 0) + 1;

      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "notes" = $1 WHERE "id" = $2`,
        JSON.stringify({
          ...m,
          aiZusammenfassung: zaehler,
          aiEntscheidungen: [...bisher, {
            zeit: new Date().toISOString(),
            massnahme, aktion, grund: (grund || "").slice(0, 80),
          }],
        }),
        rows[0].id
      );
    } catch (e) {
      // Non-fatal, wie persistMeta: eine Datenbankstörung darf die Absicherung
      // einer laufenden Position niemals aufhalten.
      console.warn(`[risk-agent] AI-Entscheidung nicht festgehalten (deal=${dealId}):`,
        e instanceof Error ? e.message : String(e));
    }
  })();
}

// ── AI Manager ────────────────────────────────────────────────────────────────

let aiClient: Anthropic | null = null;

function getAI(): Anthropic {
  if (!aiClient) {
    aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return aiClient;
}

interface AIRiskDecision {
  action: "APPROVE" | "SKIP" | "ADJUST";
  adjustedBeBuffer?: number;      // Breakeven-Puffer als Anteil der Stop-Spanne
  adjustedAtrFactor?: number;     // Trailing-Abstand als Vielfaches des ATR
  adjustedPartialRatio?: number;  // Anteil der Position, der beim Teilgewinn geht
  reason: string;
}

/** Marktlage einer offenen Position — Grundlage für die AI-Entscheidung.
 *  Alle Werte sind in processPosition() ohnehin schon berechnet; hier wird
 *  nichts zusätzlich geholt, es entstehen also keine neuen Fehlerquellen. */
interface MarktLage {
  entry: number;
  currentPrice: number;
  profitPct: number;
  atr: number;
  slRange: number;
  liveSL: number;
  // Ergänzt 11.08.: die AI wurde nach dem "Fortschritt Richtung Ziel" gefragt,
  // erfuhr aber nur, wo der STOP steht — das Ziel selbst kannte sie nicht.
  // Damit war die Zahl für sie nicht nachvollziehbar und auch nicht korrigierbar.
  liveTP: number;
  /** null = Eröffnungszeit beim Broker unbekannt (19.08.). */
  ageHours: number | null;
  style: string;
  confidence: number;
  /** Was ein ANDERES System zuletzt an dieser Position tat (11.08.).
   *  Der Python-Lifecycle bearbeitet dieselben Capital.com-Positionen und
   *  fragt den AI Manager nie — ohne diesen Hinweis entscheidet sie blind
   *  über eine Absicherung, die jemand anders gerade verändert hat. */
  fremdAktion?: { zeit: string; text: string } | null;
}

/** Hält einen AI-Wert in vertretbaren Grenzen. Ohne diese Klemme könnte ein
 *  einziger Ausreisser der AI (oder eine kaputte Antwort) den Schutz aushebeln —
 *  etwa ein Trailing-Abstand von 50 ATR, was praktisch "kein Stop" bedeutet. */
export function inGrenzen(wert: unknown, min: number, max: number): number | null {
  // null/undefined/"" heisst "nicht angegeben" — dann gilt der Regelwert.
  // Ohne diese Zeile würde Number(null) zu 0 und damit auf das Minimum
  // geklemmt: ein ausdrückliches null der AI hätte den Trailing-Stop auf den
  // engsten erlaubten Wert gesetzt statt auf die Stil-Vorgabe.
  if (wert === null || wert === undefined || wert === "") return null;
  const n = typeof wert === "number" ? wert : Number(wert);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
const GRENZEN = {
  beBuffer:     { min: 0,    max: 0.50 },  // Anteil der Stop-Spanne
  atrFactor:    { min: 0.5,  max: 4.0  },  // Vielfaches des ATR
  partialRatio: { min: 0.25, max: 0.75 },  // Anteil der Position
};

// ── Ausstiegs-Schwellen relativ zum Stop (Stufe 2, 10.08.) ───────────────────

/** Grenzen für die R-Werte aus den Einstellungen.
 *
 *  Warum geklemmt: die Werte kommen aus einem Eingabefeld. Eine 0 würde jede
 *  Absicherung sofort auslösen, eine 50 sie nie. Dieselbe Überlegung wie bei
 *  GRENZEN für die AI-Werte — nur dass hier ein Tippfehler die Quelle ist. */
const R_GRENZEN = { min: 0.2, max: 5.0 };

export interface ExitSchwellenEinstellung {
  exitThresholdsRelativeToStop: boolean;
  breakevenAtR: number;
  partialAtR: number;
  trailAtR: number;
}

/** Rechnet die R-Schwellen in dieselbe Grösse um, in der der Agent bereits
 *  denkt: Kursbewegung in Prozent vom Einstieg.
 *
 *  WOZU. getStyleThresholds() liefert feste Kursprozente (DAYTRADING 0,5 % /
 *  1,0 % / 1,5 %). Der Stop ist aber 1,5 × ATR, und ATR im Verhältnis zum Kurs
 *  liegt zwischen den Märkten weit auseinander. Gemessen am 10.08. über alle
 *  30 Symbole, ATR(14) auf Tageskerzen:
 *
 *      UKOIL   Stop 8,47 % vom Kurs -> Breakeven greift nach 0,06 R
 *      USOIL   Stop 8,22 %          -> 0,06 R
 *      BTCUSD  Stop 3,21 %          -> 0,16 R
 *      EURUSD  Stop 0,73 %          -> 0,69 R
 *      EURGBP  Stop 0,48 %          -> 1,04 R
 *
 *  Faktor 17,6 zwischen dem engsten und dem weitesten Markt. In 29 von 30
 *  Märkten greift die Absicherung, BEVOR der Trade seinen eigenen Einsatz
 *  verdient hat — auf UKOIL nimmt der Teilgewinn die halbe Position bei 0,12 R
 *  heraus, während das volle Risiko noch im Markt steht.
 *
 *  Ist der Schalter aus, wird NICHTS umgerechnet: die Regelwerte gehen
 *  unverändert zurück. Das ist exakt das bisherige Verhalten.
 *
 *  @param regel     Werte aus getStyleThresholds()
 *  @param slRange   Stop-Abstand in Kurseinheiten (schon berechnet)
 *  @param entry     Einstiegskurs
 */
export function wirksameSchwellen(
  regel: { bePct: number; partialPct: number; trailPct: number; atrFactor: number },
  slRange: number,
  entry: number,
  einstellung: ExitSchwellenEinstellung | undefined,
): { bePct: number; partialPct: number; trailPct: number; atrFactor: number; relativ: boolean } {
  if (!einstellung?.exitThresholdsRelativeToStop) {
    return { ...regel, relativ: false };
  }
  // Ohne belastbaren Stop-Abstand oder Einstieg gäbe die Umrechnung Unsinn
  // (Division durch null, Infinity). Dann lieber die Regelwerte — die haben
  // seit jeher gegriffen. Stillschweigend etwas Kaputtes zu rechnen wäre die
  // schlechtere Antwort.
  if (!(slRange > 0) || !(entry > 0) || !Number.isFinite(slRange / entry)) {
    return { ...regel, relativ: false };
  }
  const stopAnteil = slRange / entry;   // Stop-Abstand als Anteil vom Einstieg
  const r = (wert: number) =>
    Math.min(R_GRENZEN.max, Math.max(R_GRENZEN.min, Number.isFinite(wert) ? wert : 1));
  return {
    bePct:      r(einstellung.breakevenAtR) * stopAnteil,
    partialPct: r(einstellung.partialAtR)   * stopAnteil,
    trailPct:   r(einstellung.trailAtR)     * stopAnteil,
    atrFactor:  regel.atrFactor,   // der Trailing-Abstand bleibt unberührt
    relativ: true,
  };
}

/**
 * Fortschritt der Position Richtung ZIEL, als Anteil (1.0 = Ziel erreicht).
 *
 * WOZU (Fund 11.08.). Der Prompt des AI Managers schrieb "Fortschritt Richtung
 * Ziel" — bekam aber profitPct, also die blosse Kursbewegung in Prozent. Das
 * sind zwei verschiedene Grössen, und der Unterschied hängt am Markt.
 * Nachgerechnet im Moment, in dem der Breakeven auslöst (profitPct = 0,5 %):
 *
 *      UKOIL   Prompt sagte 0,5 %  —  tatsächlich  2,9 %   Faktor  5,9
 *      NAS100  Prompt sagte 0,5 %  —  tatsächlich  8,5 %   Faktor 16,9
 *      USDCAD  Prompt sagte 0,5 %  —  tatsächlich 35,7 %   Faktor 71,4
 *      EURGBP  Prompt sagte 0,5 %  —  tatsächlich 51,9 %   Faktor 103,8
 *
 * Die AI soll beurteilen, ob eine Position schon weit genug ist, und bekam
 * dafür eine Zahl, die je nach Markt um Faktor 6 bis 104 danebenlag.
 *
 * DIE FORMEL IST NICHT NEU, sondern die, die im System schon zweimal steht:
 * trade_lifecycle_manager.py (total_range / progress) und
 * icmarkets-trade-manager.ts rechnen exakt so, samt Rückfall auf slRange * 2,
 * wenn kein Take-Profit gesetzt ist. Eine dritte, eigene Rechnung wäre genau
 * die Sorte Abweichung, die später niemand mehr erklären kann.
 *
 * @param profitPct  Kursbewegung vom Einstieg, bereits richtungsbereinigt
 * @param entry      Einstiegskurs
 * @param liveTP     Take-Profit beim Broker; 0 = keiner gesetzt
 * @param slRange    Stop-Abstand in Kurseinheiten (Rückfall: Ziel = 2 R)
 */
export function fortschrittZumZiel(
  profitPct: number,
  entry: number,
  liveTP: number,
  slRange: number,
): number {
  if (!Number.isFinite(profitPct) || !(entry > 0)) return 0;
  const zielSpanne = liveTP > 0 ? Math.abs(liveTP - entry) : slRange * 2;
  if (!(zielSpanne > 0) || !Number.isFinite(zielSpanne)) return 0;
  // profitPct ist der Anteil vom Einstieg — mal entry ergibt die absolute
  // Bewegung, in derselben Einheit wie zielSpanne. Bei SELL ist profitPct
  // bereits richtungsbereinigt, deshalb braucht es hier keine Fallunterscheidung.
  const wert = (profitPct * entry) / zielSpanne;
  return Number.isFinite(wert) ? wert : 0;
}

async function askAIManager(
  symbol: string,
  direction: string,
  progress: number,
  confidence: number,
  action: "BREAKEVEN" | "TRAIL" | "PARTIAL_TP",
  lage?: MarktLage,
): Promise<AIRiskDecision> {
  try {
    const ai = getAI();

    // ERWEITERT 03.08. (Wunsch des Nutzers): Der Prompt enthielt bisher nur
    // Symbol, Richtung, Fortschritt und Confidence — KEINE einzige Marktgrösse.
    // Die AI sollte marktgerecht entscheiden, sah den Markt aber nicht. Jetzt
    // bekommt sie die Lage, die der Agent ohnehin schon kennt.
    const marktBlock = lage
      ? `
Einstieg: ${lage.entry} | aktuell: ${lage.currentPrice}
Gewinn: ${(lage.profitPct * 100).toFixed(2)}%
ATR: ${lage.atr.toFixed(5)} (${((lage.atr / Math.max(lage.currentPrice, 1e-9)) * 100).toFixed(2)}% vom Kurs — Mass für die aktuelle Schwankung)
Stop-Spanne: ${lage.slRange.toFixed(5)} | Stop steht bei: ${lage.liveSL > 0 ? lage.liveSL : "keiner"}
Ziel steht bei: ${lage.liveTP > 0 ? lage.liveTP : `keines gesetzt (gerechnet wird mit 2× Stop-Spanne)`}
Position offen seit: ${lage.ageHours == null ? "unbekannt" : `${lage.ageHours.toFixed(1)} Stunden`}
Handelsstil: ${lage.style}${lage.fremdAktion?.text
        ? `
ACHTUNG, ein zweites System verwaltet dieselbe Position: ${lage.fremdAktion.text} (${lage.fremdAktion.zeit}). Berücksichtige das — die Absicherung kann bereits enger stehen, als es hier aussieht.`
        : ""}`
      : "";

    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [{
        role: "user",
        content: `Du steuerst das Risiko einer laufenden Position.
Symbol: ${symbol} ${direction}
Anstehende Massnahme: ${action}
Fortschritt Richtung Ziel: ${(progress * 100).toFixed(1)}%
Confidence beim Einstieg: ${confidence}${marktBlock}

Richte die Massnahme an der Marktlage aus:
- Hohe Schwankung (grosser ATR im Verhältnis zum Kurs) → mehr Luft lassen, sonst wirft ein normaler Ausschlag die Position raus.
- Ruhiger Markt → enger nachziehen und Gewinn früher sichern.
- Position schon lange offen ohne Fortschritt → eher absichern als laufen lassen.

Antworte NUR mit JSON:
{"action":"APPROVE"|"SKIP"|"ADJUST","adjustedBeBuffer":0.15,"adjustedAtrFactor":1.5,"adjustedPartialRatio":0.5,"reason":"kurz"}
APPROVE = mit den Standardwerten ausführen. SKIP = jetzt nicht. ADJUST = mit deinen Werten ausführen.
Erlaubt: adjustedBeBuffer 0-0.5, adjustedAtrFactor 0.5-4.0, adjustedPartialRatio 0.25-0.75.
Nur das Feld angeben, das zur anstehenden Massnahme passt.`
      }]
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (json) {
      const roh = JSON.parse(json) as Record<string, unknown>;
      const akt = roh.action === "SKIP" || roh.action === "ADJUST" ? roh.action : "APPROVE";
      // Jeden Zahlenwert durch die Klemme schicken. Fehlt er oder ist er
      // unbrauchbar, bleibt er undefined und die Regel-Vorgabe greift.
      meldeAIEntscheidung(action, akt);
      return {
        action: akt,
        adjustedBeBuffer:     inGrenzen(roh.adjustedBeBuffer,     GRENZEN.beBuffer.min,     GRENZEN.beBuffer.max)     ?? undefined,
        adjustedAtrFactor:    inGrenzen(roh.adjustedAtrFactor,    GRENZEN.atrFactor.min,    GRENZEN.atrFactor.max)    ?? undefined,
        adjustedPartialRatio: inGrenzen(roh.adjustedPartialRatio, GRENZEN.partialRatio.min, GRENZEN.partialRatio.max) ?? undefined,
        reason: typeof roh.reason === "string" ? roh.reason.slice(0, 120) : "",
      };
    }
    // Antwort kam an, enthielt aber kein JSON — zaehlt als Ausfall, nicht als
    // Zustimmung. Sonst sieht eine kaputte Antwort aus wie ein APPROVE.
    meldeAIEntscheidung(action, "FALLBACK", "Antwort ohne JSON");
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    meldeAIEntscheidung(action, "FALLBACK", text);
    console.warn(`[risk-agent] AI Manager nicht verfügbar — Rule-Based Fallback (${text})`);
  }
  // Fallback: immer approven (Rule-Based läuft weiter)
  return { action: "APPROVE", reason: "fallback" };
}

// ── Hauptlogik: Position verarbeiten ─────────────────────────────────────────

async function processPosition(
  pos: LivePosition,
  meta: PosMeta,
  prices: PriceData,
  ctx: RiskAgentContext,
): Promise<void> {
  const { apiKey, cst, securityToken } = ctx;
  const { dealId, direction, openLevel: entry, stopLevel, profitLevel, symbol, epic } = pos;
  const isBuy = direction === "BUY";
  const currentPrice = isBuy ? prices.bid : prices.ask;
  if (!currentPrice || currentPrice <= 0) return;

  const regelSchwellen = getStyleThresholds(meta.tradingStyle);
  const liveSL = stopLevel != null ? stopLevel : 0;
  const liveTP = profitLevel != null ? profitLevel : 0;

  const slRange = liveSL > 0
    ? Math.abs(entry - liveSL)
    : (DEFAULT_SL_RANGE[symbol] ?? entry * 0.005);
  if (slRange < 0.000001) return;

  // Stufe 2 (10.08.): Schwellen relativ zum Stop, wenn eingeschaltet.
  // Steht nach slRange, weil die Umrechnung genau diesen Abstand braucht.
  // Schalter aus -> regelSchwellen unverändert, bisheriges Verhalten.
  const thresholds = wirksameSchwellen(regelSchwellen, slRange, entry, ctx.exitSchwellen);

  // Echter Profit in % — unabhängig von TP-Distanz
  const profitPct = isBuy
    ? (currentPrice - entry) / entry
    : (entry - currentPrice) / entry;

  // ATR vom Python Backend — Fallback auf slRange * 0.5
  const atr = ctx.atrMap.get(symbol) ?? ctx.atrMap.get(epic ?? "") ?? slRange * 0.5;

  const beTol = BE_TOLERANCE[symbol] ?? slRange * 0.01;
  const beZone = Math.max(beTol, slRange * 0.20);
  const alreadyAtBE = isBuy
    ? (liveSL > 0 && liveSL >= entry - beZone)
    : (liveSL > 0 && liveSL <= entry + beZone);
  const beEffective = meta.beSet || alreadyAtBE;
  // Generalkontroll-Fund C (03.08.): Bezugspunkt fürs Trailing war allein die
  // EIGENE Erinnerung (meta.trailSL), der echte Broker-Stop nur als Rückfall,
  // wenn gar keine Erinnerung vorlag. Der Python-Lifecycle bewegt denselben
  // Stop im selben 2-Minuten-Zyklus. Zog Python enger nach, wusste dieser
  // Agent nichts davon und konnte den Stop wieder zurückholen:
  // Erinnerung 105, Broker schon auf 108, neu berechnet 106 -> 106 > 105 ist
  // wahr, also wurde 106 geschrieben und die Absicherung von 108 auf 106
  // gelockert.
  // Jetzt gilt immer der ENGERE von beiden. Damit kann sich ein Stop nur noch
  // in Richtung Gewinn bewegen, egal welches System ihn zuletzt gesetzt hat.
  // (Der Breakeven-Block braucht das nicht: alreadyAtBE oben prüft bereits den
  // echten Broker-Stop und überspringt, wenn dieser schon abgesichert ist.)
  const trailFallback = liveSL > 0 ? liveSL : (isBuy ? entry - slRange : entry + slRange);
  const currentTrailSL = meta.trailSL == null
    ? trailFallback
    : (isBuy ? Math.max(meta.trailSL, trailFallback) : Math.min(meta.trailSL, trailFallback));

  // Fortschritt in R mitschreiben (Stufe 2, 10.08.). Ohne diese Zahl liesse
  // sich hinterher nicht belegen, ob die Schwellen richtig liegen — genau die
  // Frage, die dieser Umbau aufwirft. profitPct ist Kursbewegung vom Einstieg,
  // slRange/entry der Stop-Abstand in derselben Einheit.
  const fortschrittR = profitPct / (slRange / entry);
  console.log(`[risk-agent] ${symbol} ${direction} entry=${entry} cur=${currentPrice} profit=${(profitPct*100).toFixed(2)}% (${fortschrittR.toFixed(2)}R) atr=${atr.toFixed(5)} be=${beEffective}${thresholds.relativ ? ` [Schwellen relativ: BE ${(thresholds.bePct*100).toFixed(2)}% Teil ${(thresholds.partialPct*100).toFixed(2)}% Trail ${(thresholds.trailPct*100).toFixed(2)}%]` : ""}`);

  // ── Zeit-Exit ──────────────────────────────────────────────────────────────
  const style = meta.tradingStyle.toUpperCase();
  const maxHours = STYLE_MAX_HOURS[style] ?? STYLE_MAX_HOURS.DAYTRADING;
  // Alter der Position. UNBEKANNT bleibt unbekannt (19.08.): bis heute stand
  // hier `?? Date.now()`, also galt eine Position ohne Eroeffnungsdatum als
  // gerade eben eroeffnet — ageHours 0, Zeit-Exit nie. Jetzt null, und der
  // Zeit-Exit unten laesst die Position dann ausdruecklich in Ruhe, statt sie
  // auf einer erfundenen Zahl zu schliessen oder stillschweigend laufen zu
  // lassen.
  const eroeffnet = pos.createdDate ? new Date(pos.createdDate) : null;
  const ageHours = eroeffnet && !Number.isNaN(eroeffnet.getTime())
    ? (Date.now() - eroeffnet.getTime()) / 3_600_000
    : null;

  // Marktlage für den AI Manager (03.08.). Rein aus bereits berechneten Werten
  // zusammengesetzt — kein zusätzlicher Abruf, keine neue Fehlerquelle.
  const lage: MarktLage = {
    entry, currentPrice, profitPct, atr, slRange, liveSL, liveTP, ageHours, style,
    confidence: meta.confidence,
    fremdAktion: meta.fremdAktion ?? null,
  };
  // Fortschritt Richtung Ziel — EINMAL berechnet, an alle drei AI-Aufrufe.
  // Bis zum 11.08. bekam die AI hier profitPct, beschriftet als "Fortschritt
  // Richtung Ziel": je nach Markt um Faktor 6 bis 104 daneben (siehe
  // fortschrittZumZiel).
  const zielFortschritt = fortschrittZumZiel(profitPct, entry, liveTP, slRange);
  if (ageHours == null) {
    // Ohne bekannte Eröffnungszeit wird NICHT geschlossen — aber es wird auch
    // nicht mehr verschwiegen (19.08.). Einmal je Position, über denselben
    // Merker wie der geratene Stil.
    if (geratenerStilMelden(`alter:${dealId}`, false, false)) {
      console.warn(`[risk-agent] ⚠️ ${symbol} deal=${dealId}: Broker liefert keine `
        + `Eroeffnungszeit — der Zeit-Exit (${maxHours} h) kann fuer diese Position `
        + `NICHT greifen. Sie laeuft ohne Haltedauer-Grenze.`);
    }
  } else if (meta.stilGeraten === true) {
    // KEIN Zeit-Exit auf geratenem Handelsstil (19.08.).
    //
    // Ohne Datenbankzeile und ohne Speicher-Eintrag steht der Stil auf dem
    // Standardwert DAYTRADING — also 24 Stunden. Waere die Position in
    // Wirklichkeit SWING gedacht (168 h), wuerde sie 144 Stunden zu frueh
    // geschlossen. Das ist kein Schutz mehr, das ist ein Eingriff auf einer
    // Annahme, und er kostet echtes Geld.
    //
    // Nachgewiesen am 19.08.: vier offene Positionen (Gold, GBPUSD, UKOIL,
    // NAS100) ohne jede Journal-Zeile, alle juenger als 24 Stunden — der
    // Zeit-Exit haette sie binnen Stunden auf einem geratenen Wert
    // geschlossen.
    //
    // Breakeven, Teilgewinn und Trailing laufen weiter: die BEWEGEN einen
    // Stop in Richtung Gewinn oder nehmen Teilgewinn mit. Sie koennen eine
    // Position nicht beenden. Ein Zeit-Exit kann.
    if (geratenerStilMelden(`zeitexit:${dealId}`, false, false)) {
      console.warn(`[risk-agent] ⚠️ ${symbol} deal=${dealId}: Zeit-Exit AUSGESETZT — `
        + `der Handelsstil ist geraten (${style}, ${maxHours} h) und wuerde die Position `
        + `auf einer Annahme schliessen. Breakeven, Teilgewinn und Trailing laufen weiter. `
        + `Sobald eine Journal-Zeile mit tradingStyle existiert, greift er wieder.`);
    }
  } else if (ageHours >= maxHours) {
    const closeResult = await capitalClosePosition(apiKey, cst, securityToken, dealId);
    if (closeResult.ok) {
      positionMeta.delete(dealId);
      agentBus.publish({
        type: "RISK:POSITION_CLOSED",
        agentId: AGENT_ID,
        timestamp: new Date().toISOString(),
        payload: { dealId, symbol, direction, reason: "ZEIT_EXIT", ageHours },
      });
      console.log(`[risk-agent] ⏰ Zeit-Exit: ${symbol} age=${ageHours.toFixed(1)}h`);
    }
    return;
  }

  // ── Partial TP — bei 1.0% Profit (Daytrading), 0.6% Scalping, 2.0% Swing ──
  if (!meta.partialDone && profitPct >= thresholds.partialPct) {
    const aiDecision = await askAIManager(symbol, direction, zielFortschritt, meta.confidence, "PARTIAL_TP", lage);
    merkeAIEntscheidung(dealId, "PARTIAL_TP", aiDecision.action, aiDecision.reason);

    if (aiDecision.action !== "SKIP") {
      const rawSize = pos.size > 0 ? pos.size : 0;
      // ERWEITERT 03.08.: Der Teilgewinn war immer starr die Hälfte. Die AI
      // durfte zwar ADJUST antworten, ihr Wert verfiel aber ungenutzt — nur
      // "nicht SKIP" wurde geprüft. Jetzt darf sie den Anteil bestimmen
      // (0.25 bis 0.75, geklemmt); ohne brauchbaren Wert bleibt es die Hälfte.
      const anteil = aiDecision.action === "ADJUST" && aiDecision.adjustedPartialRatio != null
        ? aiDecision.adjustedPartialRatio
        : 0.5;
      const partialSize = rawSize >= 2 ? Math.floor(rawSize * anteil) : 0;

      if (partialSize > 0) {
        const epicForClose = EPIC_MAP[symbol] ?? epic ?? symbol;
        const result = await capitalClosePartial(apiKey, cst, securityToken, epicForClose, direction, partialSize);
        if (result.ok) {
          positionMeta.set(dealId, { ...meta, partialDone: true });
          // partialSize MIT festhalten (11.08.). Grund: partialDone wird auch
          // im else-Zweig unten gesetzt, wenn die Position zu klein zum
          // Halbieren war und GAR NICHTS geschlossen wurde. Wer den Merker
          // allein liest, kann beides nicht unterscheiden — und der
          // Python-Lifecycle in instrumentation.ts muss genau das können,
          // sonst nimmt er entweder ein zweites Mal Teilgewinn oder er lässt
          // für kleine Positionen einen aus, der heute funktioniert.
          persistMeta(dealId, { partialDone: true, partialSize });
          agentBus.publish({
            type: "RISK:PARTIAL_TP",
            agentId: AGENT_ID,
            timestamp: new Date().toISOString(),
            payload: { dealId, symbol, direction, partialSize, profitPct, aiReason: aiDecision.reason },
          });
          console.log(`[risk-agent] 💰 Partial TP: ${symbol} ${partialSize}/${rawSize} profit=${(profitPct*100).toFixed(2)}% (AI: ${aiDecision.reason})`);
        }
      } else {
        // Position zu klein zum Halbieren — als erledigt merken, damit es nicht
        // jeden Zyklus erneut versucht wird (auch über Neustarts hinweg).
        // partialSize AUSDRÜCKLICH 0: hier wurde nichts geschlossen. Der
        // Python-Lifecycle darf seinen eigenen Teilgewinn dann noch nehmen —
        // er rechnet mit kleineren Stückelungen als dieser Zweig.
        positionMeta.set(dealId, { ...meta, partialDone: true });
        persistMeta(dealId, { partialDone: true, partialSize: 0 });
      }
    }
  }

  // ── Breakeven — bei 0.5% Profit (Daytrading), 0.3% Scalping, 1.0% Swing ──
  if (!beEffective && profitPct >= thresholds.bePct) {
    const aiDecision = await askAIManager(symbol, direction, zielFortschritt, meta.confidence, "BREAKEVEN", lage);
    merkeAIEntscheidung(dealId, "BREAKEVEN", aiDecision.action, aiDecision.reason);

    // AI kann BE-Buffer anpassen (default 15%)
    const beBufferRatio = aiDecision.action === "ADJUST" && aiDecision.adjustedBeBuffer != null
      ? aiDecision.adjustedBeBuffer
      : 0.15;

    if (aiDecision.action !== "SKIP") {
      const beBuffer = slRange * beBufferRatio;
      const newSL = isBuy ? entry - beBuffer : entry + beBuffer;

      const upd = await capitalUpdatePosition(apiKey, cst, securityToken, dealId, newSL, liveTP > 0 ? liveTP : undefined);
      if (upd.ok) {
        positionMeta.set(dealId, { ...meta, beSet: true, trailSL: newSL });
        persistMeta(dealId, { beSet: true, trailSL: newSL });
        agentBus.publish({
          type: "RISK:BE_SET",
          agentId: AGENT_ID,
          timestamp: new Date().toISOString(),
          payload: { dealId, symbol, direction, entry, newSL, beBuffer, profitPct, aiReason: aiDecision.reason },
        });
        console.log(`[risk-agent] ✅ BE: ${symbol} SL=${newSL.toFixed(5)} (buffer=${(beBufferRatio*100).toFixed(0)}% AI:${aiDecision.reason})`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol, direction, entry, broker: "Capital.com" });
        } catch { /* non-fatal */ }
        return;
      }
    } else {
      console.log(`[risk-agent] ⏸ BE übersprungen: ${symbol} (AI: ${aiDecision.reason})`);
    }
  }

  // ── ATR Trailing Stop — ab 1.5% Profit (Daytrading), 1.0% Scalping, 3.0% Swing ──
  if (profitPct >= thresholds.trailPct) {
    const prevPeak = meta.peakPrice ?? currentPrice;
    const newPeak = isBuy ? Math.max(prevPeak, currentPrice) : Math.min(prevPeak, currentPrice);

    // ATR-basierte Trail-Distanz (1.5× ATR für Daytrading)
    const trailSLmitFaktor = (faktor: number) => {
      const distanz = atr * faktor;
      return isBuy
        ? Math.max(newPeak - distanz, entry)
        : Math.min(newPeak + distanz, entry);
    };
    const newTrailSL = trailSLmitFaktor(thresholds.atrFactor);

    const shouldUpdate = isBuy
      ? newTrailSL > currentTrailSL + beTol
      : newTrailSL < currentTrailSL - beTol;

    if (shouldUpdate) {
      const aiDecision = await askAIManager(symbol, direction, zielFortschritt, meta.confidence, "TRAIL", lage);
      merkeAIEntscheidung(dealId, "TRAIL", aiDecision.action, aiDecision.reason);

      if (aiDecision.action !== "SKIP") {
        // ERWEITERT 03.08.: Der Trailing-Abstand war starr an den Handelsstil
        // gebunden (1.0/1.5/2.5× ATR). Die AI durfte ADJUST antworten, ihr Wert
        // wurde aber nie verwendet. Jetzt darf sie den Abstand an die aktuelle
        // Schwankung anpassen — in ruhigem Markt enger, in bewegtem weiter.
        //
        // Zwei Riegel dagegen, dass daraus eine Lockerung wird:
        //   1. Der angepasste Stop muss dieselbe Bedingung erfüllen wie der
        //      regelbasierte (shouldUpdate) — sonst gilt weiter der Regelwert.
        //   2. Zusätzlich greift die Sicherung aus Fund C: ein Stop kann sich
        //      am Broker ohnehin nur noch in Richtung Gewinn bewegen.
        let trailSL = newTrailSL;
        let genutzterFaktor = thresholds.atrFactor;
        if (aiDecision.action === "ADJUST" && aiDecision.adjustedAtrFactor != null) {
          const kandidat = trailSLmitFaktor(aiDecision.adjustedAtrFactor);
          const kandidatOk = isBuy
            ? kandidat > currentTrailSL + beTol
            : kandidat < currentTrailSL - beTol;
          if (kandidatOk) {
            trailSL = kandidat;
            genutzterFaktor = aiDecision.adjustedAtrFactor;
          } else {
            console.log(`[risk-agent] ↩ ${symbol}: AI-Trail-Faktor ${aiDecision.adjustedAtrFactor} wäre lockerer — Regelwert ${thresholds.atrFactor} bleibt`);
          }
        }

        const upd = await capitalUpdatePosition(apiKey, cst, securityToken, dealId, trailSL, liveTP > 0 ? liveTP : undefined);
        if (upd.ok) {
          positionMeta.set(dealId, { ...meta, beSet: trailSL >= entry, peakPrice: newPeak, trailSL });
          persistMeta(dealId, { beSet: trailSL >= entry, peakPrice: newPeak, trailSL });
          agentBus.publish({
            type: "RISK:TRAIL_UPDATED",
            agentId: AGENT_ID,
            timestamp: new Date().toISOString(),
            payload: { dealId, symbol, direction, newTrailSL: trailSL, newPeak, atr, atrFactor: genutzterFaktor, aiReason: aiDecision.reason },
          });
          console.log(`[risk-agent] 📈 ATR Trail: ${symbol} peak=${newPeak.toFixed(5)} SL=${trailSL.toFixed(5)} ATR=${atr.toFixed(5)}×${genutzterFaktor}${genutzterFaktor !== thresholds.atrFactor ? " (AI: " + aiDecision.reason + ")" : ""}`);
        }
      }
    } else if (newPeak !== prevPeak) {
      positionMeta.set(dealId, { ...meta, peakPrice: newPeak });
    }
  }
}

// ── Öffentliche API ───────────────────────────────────────────────────────────

export async function runRiskAgent(ctx: RiskAgentContext): Promise<void> {
  console.log(`[risk-agent] gestartet — ${ctx.positions.length} Positionen`);

  for (const pos of ctx.positions) {
    if (!pos.dealId || !pos.openLevel) continue;

    const symbol = pos.symbol || pos.epic || "";
    const prices = ctx.priceMap.get(symbol) ?? ctx.priceMap.get(pos.epic ?? "");
    if (!prices) {
      console.log(`[risk-agent] ⚠️ kein Preis für ${symbol} — übersprungen`);
      continue;
    }

    const hatSpeicher = positionMeta.has(pos.dealId);
    const mem = positionMeta.get(pos.dealId) ?? {
      beSet: false, partialDone: false, trailSL: null, peakPrice: null, confidence: 72, tradingStyle: "DAYTRADING"
    };
    // Merge DB + in-memory: für Booleans (beSet, partialDone) gewinnt TRUE aus beiden Quellen.
    // DB schreibt beSet/partialDone nie zurück → in-memory-State darf nicht verloren gehen.
    const dbEntry = ctx.dbMeta.get(pos.dealId);
    // Ohne beide Quellen wird der Stil GERATEN — das darf nicht stumm
    // geschehen (19.08.). Siehe geratenerStilMelden().
    if (geratenerStilMelden(pos.dealId, !!dbEntry, hatSpeicher)) {
      console.warn(`[risk-agent] ⚠️ ${symbol} deal=${pos.dealId}: weder Datenbankzeile noch `
        + `Speicher-Eintrag — Stil und Confidence GERATEN (${mem.tradingStyle}, ${mem.confidence}). `
        + `Der Zeit-Exit rechnet damit mit `
        + `${STYLE_MAX_HOURS[mem.tradingStyle.toUpperCase()] ?? STYLE_MAX_HOURS.DAYTRADING} h, `
        + `und die Exit-Schwellen haengen an dieser Confidence-Stufe.`);
    }
    const meta: PosMeta = {
      beSet:        (dbEntry?.beSet || mem.beSet),
      partialDone:  (dbEntry?.partialDone || mem.partialDone),
      trailSL:      dbEntry?.trailSL ?? mem.trailSL,
      peakPrice:    dbEntry?.peakPrice ?? mem.peakPrice,
      confidence:   dbEntry?.confidence ?? mem.confidence,
      tradingStyle: dbEntry?.tradingStyle ?? mem.tradingStyle,
      // NUR aus der Datenbank: der Vermerk stammt vom Python-Lifecycle, der
      // seinen Eingriff in Trade.notes schreibt. Die Map dieses Prozesses weiss
      // davon nichts. Ohne diese Zeile bliebe das Feld undefined und der
      // Hinweis erreichte die AI nie — und weil es optional ist, hätte auch
      // tsc nichts gemeldet.
      fremdAktion:  dbEntry?.fremdAktion ?? null,
      // Weder Datenbank noch Speicher: Stil und Confidence sind die
      // Standardwerte, also geraten (19.08.).
      stilGeraten:  !dbEntry && !hatSpeicher,
    };

    try {
      await processPosition(pos, meta, prices, ctx);
    } catch (err) {
      console.error(`[risk-agent] ❌ Fehler bei ${symbol}:`, err);
      agentBus.publish({
        type: "RISK:ERROR",
        agentId: AGENT_ID,
        timestamp: new Date().toISOString(),
        payload: { dealId: pos.dealId, symbol, error: String(err) },
      });
    }
  }

  // Cleanup abgeschlossene Positionen
  const liveIds = new Set(ctx.positions.map(p => p.dealId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveIds.has(id)) positionMeta.delete(id);
  }
  // Auch die Meldungs-Merker mitraeumen (19.08.). Sie wuchsen sonst mit jeder
  // je gesehenen dealId weiter — je Position bis zu drei Eintraege
  // (Stil geraten, Alter unbekannt, Zeit-Exit ausgesetzt) und nie wieder
  // entfernt. Klein, aber unbegrenzt; und schliesst sich eine Position und
  // taucht dieselbe dealId spaeter erneut auf, soll erneut gemeldet werden.
  vergissGemeldete(liveIds);

  console.log(`[risk-agent] Zyklus abgeschlossen`);
}

export function getRiskAgentState(): Map<string, PosMeta> {
  return new Map(positionMeta);
}

/**
 * Liest aus Trade.notes, welche Positionen schon einen ECHTEN Teilgewinn
 * hinter sich haben (11.08.).
 *
 * Als eigene Funktion, nicht als Schleife in instrumentation.ts: dort liesse
 * sie sich nicht ausführen. Im Sabotage-Lauf war die eingebettete Fassung
 * abschaltbar (`if (false)`), ohne dass etwas rot wurde — der Riegel hätte
 * dann nie gegriffen, weil die Menge immer leer geblieben wäre.
 *
 * `partialSize > 0` ist der Kern: partialDone allein wird auch gesetzt, wenn
 * die Position zu klein zum Halbieren war und GAR NICHTS geschlossen wurde.
 * Dort soll der Python-Teilgewinn weiter greifen — er rechnet mit kleineren
 * Stückelungen.
 */
export function teilgewinnStand(
  zeilen: ReadonlyArray<{ notes: string | null }> | null | undefined,
): Set<string> {
  const menge = new Set<string>();
  for (const zeile of zeilen ?? []) {
    if (!zeile?.notes) continue;
    try {
      const m = JSON.parse(zeile.notes) as {
        dealId?: string; partialDone?: boolean; partialSize?: number;
      };
      if (m.dealId && m.partialDone && (m.partialSize ?? 0) > 0) {
        menge.add(String(m.dealId));
      }
    } catch {
      // Eine kaputte Notiz darf die übrigen nicht mitnehmen — sonst fiele der
      // Riegel für ALLE Positionen aus, weil eine einzige Zeile Unsinn enthält.
    }
  }
  return menge;
}

/** Stammdaten, die der Python-Lifecycle beim Registrieren braucht (18.08.). */
export interface LifecycleStammdaten {
  tradingStyle: string;
  confidence: number;
}

/** Offene Broker-Position, so wie sie `capitalGetPositions()` liefert (18.08.). */
export interface LifecyclePosition {
  dealId?: string | null;
  symbol?: string | null;
  epic?: string | null;
  direction?: string | null;
  size?: number | null;
  openLevel?: number | null;
  stopLevel?: number | null;
  profitLevel?: number | null;
  createdDate?: string | null;
}

/**
 * Liest Handelsstil und Confidence je dealId aus Trade.notes (18.08.).
 *
 * Beides steht NICHT in der Broker-Position, entscheidet beim Python-Lifecycle
 * aber über echtes Verhalten: `confidence` legt den Breakeven-Punkt fest
 * (0.40 / 0.55 / 0.70 je Stufe), `tradingStyle` die Haltedauer bis zum
 * Zeit-Exit (SCALPING 4 h, DAYTRADING 24 h, SWING 168 h). Ein SWING-Trade mit
 * geratenem DAYTRADING würde 144 Stunden zu früh geschlossen — deshalb wird
 * hier nichts angenommen: fehlt eines von beiden, entsteht kein Eintrag und
 * die Position wird später NICHT nachregistriert.
 */
export function stammdatenAusNotizen(
  zeilen: ReadonlyArray<{ notes: string | null }> | null | undefined,
): Map<string, LifecycleStammdaten> {
  const karte = new Map<string, LifecycleStammdaten>();
  for (const zeile of zeilen ?? []) {
    if (!zeile?.notes) continue;
    try {
      const m = JSON.parse(zeile.notes) as {
        dealId?: string; tradingStyle?: string; confidence?: number;
      };
      const stil = String(m.tradingStyle ?? "").trim();
      // Bewusst typeof statt Number(): Number(null) ist 0, nicht NaN. Eine
      // Notiz mit `confidence: null` wuerde sonst als Confidence 0 durchgehen
      // — also geraten statt uebersprungen, und der Breakeven-Punkt spraenge
      // ungefragt auf die unterste Stufe.
      const conf = m.confidence;
      if (m.dealId && stil && typeof conf === "number" && Number.isFinite(conf)) {
        karte.set(String(m.dealId), { tradingStyle: stil, confidence: conf });
      }
    } catch {
      // Eine kaputte Notiz darf die übrigen nicht mitnehmen.
    }
  }
  return karte;
}

const gerateneGemeldet = new Set<string>();

/**
 * Muss für diese Position gemeldet werden, dass Stil und Confidence GERATEN
 * sind? Gibt `true` genau EINMAL je dealId zurück (19.08.).
 *
 * DER ANLASS. Findet der RiskAgent weder eine Datenbankzeile (`dbMeta`) noch
 * einen Speicher-Eintrag (`positionMeta`), fällt er auf feste Standardwerte
 * zurück: `tradingStyle: "DAYTRADING"`, `confidence: 72`. Das ist als Rückfall
 * vertretbar, war aber vollkommen UNSICHTBAR — und es entscheidet über Geld:
 * der Zeit-Exit rechnet dann mit 24 Stunden statt der 168 eines SWING-Trades,
 * und die Exit-Schwellen hängen an der Confidence-Stufe.
 *
 * In Produktion trat genau das am 19.08. ein: vier offene Positionen beim
 * Broker, null passende Zeilen in der Datenbank — der RiskAgent verwaltete
 * alle vier mit geratenem Stil, ohne dass irgendwo etwas davon stand.
 *
 * Genau EINMAL je Position, nicht je Zyklus: die Schleife läuft alle zwei
 * Minuten, eine Dauerwarnung wäre nach einer Stunde Rauschen. Dieselbe
 * Überlegung wie bei den Ausfall-Meldungen in python-status.ts.
 */
export function geratenerStilMelden(
  dealId: string,
  hatDbEintrag: boolean,
  hatSpeicher: boolean,
): boolean {
  if (!dealId) return false;
  if (hatDbEintrag || hatSpeicher) return false;
  if (gerateneGemeldet.has(dealId)) return false;
  gerateneGemeldet.add(dealId);
  return true;
}

/**
 * Entfernt die Merker zu Positionen, die es nicht mehr gibt (19.08.).
 *
 * Ohne das wuechse die Menge mit jeder je gesehenen dealId weiter — je
 * Position bis zu drei Eintraege, und nie wieder entfernt. Klein, aber
 * unbegrenzt. Zweiter Zweck: taucht dieselbe dealId spaeter erneut auf, soll
 * erneut gemeldet werden statt stumm zu bleiben.
 *
 * Die Merker tragen Praefixe (`alter:`, `zeitexit:`) — verglichen wird
 * deshalb der Teil hinter dem letzten Doppelpunkt.
 */
export function vergissGemeldete(lebendeDealIds: ReadonlySet<string>): void {
  for (const schluessel of [...gerateneGemeldet]) {
    const id = schluessel.includes(":")
      ? schluessel.slice(schluessel.indexOf(":") + 1)
      : schluessel;
    if (!lebendeDealIds.has(id)) gerateneGemeldet.delete(schluessel);
  }
}

/** Nur für Tests und Prüfer. */
export function resetGerateneStammdaten(): void {
  gerateneGemeldet.clear();
}

/** Aufschlüsselung der gelesenen Trade-Notizen (19.08.). */
export interface NotizenBefund {
  zeilen: number;
  lesbar: number;
  mitDealId: number;
  mitStil: number;
  mitConfidence: number;
}

/**
 * Zählt, WORAN es liegt, wenn keine Stammdaten zustande kommen (19.08.).
 *
 * ANLASS. In Produktion stand am 19.08. im Log:
 *   "Python kennt 0 von 4 Positionen, Stammdaten fuer 0, nachzureichen 0"
 * Der Fail-safe griff also richtig (ohne Stil und Confidence wird nicht
 * geraten), aber das Nachregistrieren lief damit ins Leere — und die Zeile
 * konnte nicht sagen, WARUM. Zwei ganz verschiedene Ursachen sahen gleich aus:
 *
 *   zeilen = 0    die Abfrage findet keine offenen Trades. Dann sind Datenbank
 *                 und Broker uneinig — ein eigener, groesserer Befund.
 *   zeilen > 0    die Zeilen sind da, aber in den Notizen fehlt ein Feld.
 *                 mitStil und mitConfidence sagen welches.
 *
 * Reine Zaehlung ohne Inhalt: es werden nur Anzahlen zurueckgegeben, nie
 * Notiz-Text. Damit landet nichts aus den Notizen im Log.
 */
export function notizenBefund(
  zeilen: ReadonlyArray<{ notes: string | null }> | null | undefined,
): NotizenBefund {
  const aus: NotizenBefund = {
    zeilen: 0, lesbar: 0, mitDealId: 0, mitStil: 0, mitConfidence: 0,
  };
  for (const zeile of zeilen ?? []) {
    aus.zeilen++;
    if (!zeile?.notes) continue;
    let m: { dealId?: unknown; tradingStyle?: unknown; confidence?: unknown };
    try {
      m = JSON.parse(zeile.notes) as typeof m;
    } catch {
      continue;
    }
    aus.lesbar++;
    if (m.dealId) aus.mitDealId++;
    if (String(m.tradingStyle ?? "").trim()) aus.mitStil++;
    if (typeof m.confidence === "number" && Number.isFinite(m.confidence)) {
      aus.mitConfidence++;
    }
  }
  return aus;
}

/**
 * Welche offenen Positionen muss der Python-Lifecycle nachgereicht bekommen?
 * (18.08.)
 *
 * DAS PROBLEM. `_trades` im Python-Lifecycle liegt nur im Arbeitsspeicher und
 * wird ausschliesslich beim Eröffnen gefüllt (orchestrator-agent.ts). Nach
 * jedem Neustart des Dienstes — also nach jedem Deploy — kennt er die offenen
 * Positionen nicht mehr und antwortet still mit `{"action": null}`, während
 * die Schleife weiter „N Positionen für Lifecycle-Update" meldet. Der Schutz
 * bleibt (der RiskAgent hier hat Breakeven, Teilgewinn, Trailing und Zeit-Exit
 * selbst), aber die zweite Schicht fällt lautlos aus.
 *
 * WARUM NICHT EINFACH IMMER REGISTRIEREN. `register_trade()` überschreibt den
 * Eintrag und feuert `TRADE_OPENED`. Blindes Registrieren würde jeden Zyklus
 * `be_set`, `partial_done` und `trail_sl` zurücksetzen und alle zwei Minuten
 * eine Telegram-Meldung auslösen. Deshalb wird nur ergänzt, was fehlt.
 *
 * ALLE ANGABEN KOMMEN VOM BROKER, nicht aus der Datenbank: `openLevel`,
 * `stopLevel` (der LIVE nachgezogene Stop, nicht der ursprüngliche) und
 * `createdDate` als echte Eröffnungszeit. Damit stimmt der Zustand nach dem
 * Nachregistrieren mit der Wirklichkeit überein, und der Zeit-Exit rechnet ab
 * dem richtigen Zeitpunkt statt ab jetzt.
 *
 * FAIL-SAFE. `bekannt === null` heisst: die Abfrage ist fehlgeschlagen. Dann
 * wird NICHTS registriert — lieber eine Runde ohne zweite Schicht als ein
 * Zurücksetzen der Merker auf einer laufenden Position.
 */
export function nachzuregistrieren(
  positionen: ReadonlyArray<LifecyclePosition> | null | undefined,
  bekannt: ReadonlySet<string> | null | undefined,
  stammdaten: ReadonlyMap<string, LifecycleStammdaten> | null | undefined,
): Array<{
  tradeId: string; symbol: string; direction: "BUY" | "SELL"; entry: number;
  stopLoss: number; takeProfit: number; size: number; confidence: number;
  tradingStyle: string; broker: string; openedAt: string; silent: true;
}> {
  // Abfrage fehlgeschlagen → nichts tun.
  if (!bekannt) return [];

  const aus: Array<{
    tradeId: string; symbol: string; direction: "BUY" | "SELL"; entry: number;
    stopLoss: number; takeProfit: number; size: number; confidence: number;
    tradingStyle: string; broker: string; openedAt: string; silent: true;
  }> = [];

  for (const pos of positionen ?? []) {
    const tradeId = String(pos?.dealId ?? "");
    if (!tradeId) continue;
    // Python kennt ihn schon — NICHT überschreiben.
    if (bekannt.has(tradeId)) continue;

    // Stil und Confidence sind unbekannt → nicht raten, nicht registrieren.
    const stamm = stammdaten?.get(tradeId);
    if (!stamm) continue;

    const richtung = String(pos?.direction ?? "").toUpperCase();
    if (richtung !== "BUY" && richtung !== "SELL") continue;

    const entry = Number(pos?.openLevel);
    if (!Number.isFinite(entry) || entry <= 0) continue;

    const size = Number(pos?.size);
    if (!Number.isFinite(size) || size <= 0) continue;

    // Ohne echte Eröffnungszeit würde der Zeit-Exit ab JETZT zählen und die
    // Position zu lange halten. Lieber gar nicht registrieren.
    const roh = String(pos?.createdDate ?? "");
    const zeit = roh ? new Date(roh) : null;
    if (!zeit || Number.isNaN(zeit.getTime())) continue;

    const stop = Number(pos?.stopLevel);
    const ziel = Number(pos?.profitLevel);

    aus.push({
      tradeId,
      symbol:       String(pos?.symbol ?? pos?.epic ?? ""),
      direction:    richtung,
      entry,
      stopLoss:     Number.isFinite(stop) && stop > 0 ? stop : 0,
      takeProfit:   Number.isFinite(ziel) && ziel > 0 ? ziel : 0,
      size,
      confidence:   stamm.confidence,
      tradingStyle: stamm.tradingStyle,
      broker:       "Capital.com",
      openedAt:     zeit.toISOString(),
      // OHNE Eröffnungsmeldung: register_trade() feuert sonst TRADE_OPENED,
      // und der Nutzer bekäme nach jedem Deploy für jede laufende Position
      // eine "Trade ausgeführt"-Meldung für einen Trade von vorgestern.
      silent:       true,
    });
  }
  return aus;
}

/**
 * Darf ein FREMDES System (Python-Lifecycle) hier Teilgewinn nehmen? (11.08.)
 *
 * Als eigene Funktion, nicht als eingebettete if-Kette in instrumentation.ts:
 * dort liesse sie sich nicht ausführen und damit auch nicht beweisen. Der
 * Prüfer `teilgewinn` ruft genau diese Funktion auf.
 *
 * DAS PROBLEM. Im selben 2-Minuten-Zyklus läuft erst runActiveTradeManager()
 * -> runRiskAgent(), danach der Python-Lifecycle. Beide nehmen Teilgewinn,
 * beide führen einen eigenen Merker, keiner kennt den anderen:
 *   RiskAgent  partialDone in Trade.notes, überlebt Neustarts
 *   Python     trade.partial_done nur im Arbeitsspeicher des Backends
 * Und trade.size im Python-Lifecycle stammt aus der REGISTRIERUNG und wird nie
 * aktualisiert. Nach einem Teilgewinn des RiskAgent ist die gewünschte Menge
 * deshalb auf eine Grösse bezogen, die es nicht mehr gibt — sie schliesst die
 * ganze Restposition statt der Hälfte, und die Position läuft nie bis zum Ziel
 * bei 2 R.
 *
 * @param dealId            Position beim Broker
 * @param gewuenschteMenge  was der Python-Lifecycle schliessen will
 * @param offeneGroesse     was beim Broker JETZT wirklich offen ist (pos.size)
 * @param schonTeilgewonnen dealIds mit bereits erfolgtem ECHTEN Teilgewinn
 */
export function teilgewinnErlaubt(
  dealId: string,
  gewuenschteMenge: number,
  offeneGroesse: number,
  schonTeilgewonnen: ReadonlySet<string>,
): { erlaubt: boolean; grund: string } {
  if (!dealId) return { erlaubt: false, grund: "keine dealId" };
  if (!(gewuenschteMenge > 0)) {
    return { erlaubt: false, grund: `unbrauchbare Menge ${gewuenschteMenge}` };
  }
  // Riegel 1: der RiskAgent war schon dran.
  if (schonTeilgewonnen.has(dealId)) {
    return { erlaubt: false, grund: "der RiskAgent hat den Teilgewinn bereits genommen" };
  }
  // Riegel 2: niemals mehr schliessen als offen ist. Ein "Teil"-Gewinn, der
  // 100 % schliesst, ist eine Vollschliessung unter falschem Namen. Greift auch
  // dann, wenn Riegel 1 wegen eines Datenbank-Aussetzers leer blieb.
  if (!(offeneGroesse > 0)) {
    return { erlaubt: false, grund: `offene Grösse unbekannt (${offeneGroesse})` };
  }
  if (gewuenschteMenge >= offeneGroesse) {
    return {
      erlaubt: false,
      grund: `${gewuenschteMenge} >= offene Grösse ${offeneGroesse} — würde die ganze Position schliessen`,
    };
  }
  return { erlaubt: true, grund: "" };
}

/**
 * Vermerkt einen Teilgewinn, den ein ANDERES System genommen hat (11.08.).
 *
 * Aufrufer ist der Python-Lifecycle-Zweig in instrumentation.ts. Ohne diesen
 * Vermerk nähme dieser Agent im nächsten Zyklus seinerseits noch einen
 * Teilgewinn — beide führten bis heute getrennte Merker und keiner kannte den
 * anderen. Ergebnis wären zwei Teilverkäufe auf derselben Position.
 *
 * Geschrieben wird BEIDES:
 *   positionMeta  wirkt sofort im laufenden Prozess (runRiskAgent liest es
 *                 über mem, und partialDone gewinnt dort als TRUE aus beiden
 *                 Quellen)
 *   Trade.notes   überlebt einen Neustart — genau das kann der Python-Merker
 *                 nicht, der liegt nur im Arbeitsspeicher des Backends
 *
 * partialSize wird mitgeschrieben, weil partialDone allein nicht unterscheidet,
 * ob wirklich etwas geschlossen wurde (siehe den else-Zweig beim Teilgewinn:
 * dort wird der Merker gesetzt, ohne dass ein Verkauf stattfand).
 */
/**
 * Vermerkt, dass ein ANDERES System an dieser Position gehandelt hat (11.08.).
 *
 * WOZU. Auf denselben Capital.com-Positionen arbeitet im selben 2-Minuten-Zyklus
 * auch der Python-Lifecycle: er zieht Stops nach, nimmt Teilgewinn und schliesst
 * bei Zeit-Exit. Er fragt den AI Manager nie — und der AI Manager erfuhr
 * umgekehrt nie, dass dort jemand eingegriffen hat. Er entschied also über eine
 * Position, deren Absicherung ein zweites System kurz zuvor verändert hatte,
 * ohne das zu wissen.
 *
 * BEWUSST NICHT UMGEKEHRT GELÖST: dem AI Manager ein Veto über den
 * Python-Lifecycle zu geben, würde die Absicherung SCHWÄCHEN — ein SKIP könnte
 * dann einen schützenden Stop verhindern. Der Backstop bleibt regelbasiert und
 * unantastbar; die AI wird informiert, nicht ermächtigt.
 */
export function merkeFremdAktion(dealId: string, beschreibung: string): void {
  if (!dealId || !beschreibung) return;
  persistMeta(dealId, {
    fremdAktion: { zeit: new Date().toISOString(), text: beschreibung.slice(0, 120) },
  });
}

export function merkeTeilgewinn(dealId: string, partialSize: number): void {
  if (!dealId || !(partialSize > 0)) return;
  const vorher = positionMeta.get(dealId) ?? {
    beSet: false, partialDone: false, trailSL: null, peakPrice: null,
    confidence: 72, tradingStyle: "DAYTRADING",
  };
  positionMeta.set(dealId, { ...vorher, partialDone: true });
  persistMeta(dealId, { partialDone: true, partialSize });
  console.log(`[risk-agent] Teilgewinn von aussen vermerkt: deal=${dealId} vol=${partialSize}`);
}
