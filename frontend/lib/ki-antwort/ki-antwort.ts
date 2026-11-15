/**
 * Die Antwort der KI ehrlich lesen (15.11.)
 *
 * ANLASS. `ai-analysis-engine.ts` baute das Claude-Urteil so:
 *
 *     const parsedRR = parsed.rewardRiskRatio ?? rrRatio;
 *     claude = {
 *       …
 *       maxRiskPercent: parsed.maxRiskPercent ?? 1.0,
 *       reasoning: parsed.reasoning ?? "",
 *       rewardRiskRatio: parsedRR,
 *       eigenesUrteil: parsed.approved,
 *     };
 *
 * `parsed` kommt aus `parseJSON<Partial<ClaudeRiskAssessment>>`, und das ist
 * ein **reiner Cast** (`JSON.parse(...) as T`) — keine Prüfung. Zur Laufzeit
 * steht dort, was das Modell geschickt hat. Und `??` fängt davon GENAU ZWEI
 * Werte: `null` und `undefined`. JSON kennt kein `NaN`, aber Text, Objekt,
 * Array und `true` — alle vier kommen durch.
 *
 * AUSGERECHNET, nicht geschlossen (`mess-claude-felder.js`):
 *
 *     maxRiskPercent "0.5"   -> Math.min("0.5", 1) = 0.5
 *                               eine ZEICHENKETTE bestimmt die Positionsgroesse
 *     maxRiskPercent true    -> Math.min(true, 1)  = 1   (1 % Risiko aus einem Boolean)
 *     rewardRiskRatio "5"    -> "5" >= 1.5 ist TRUE      (Freigabe auf einer Zeichenkette)
 *     rewardRiskRatio "abc"  -> rrZuKlein=true, dann `.toFixed(2)` WIRFT
 *     reasoning {}           -> `.slice(0, 90)` WIRFT
 *
 * DIE ZWEI WUERFE SIND ZWINGEND, nicht moeglich: bei nicht-numerischem R/R
 * ist `approved` falsch, also wird der Ablehnungszweig betreten, und genau
 * dort steht `.toFixed(2)`. Mit Klammerzaehlung gemessen liegen beide
 * Stellen auf **try-Tiefe 0** — der Wurf verlaesst `analyzeMarkets`,
 * `analysis-agent.ts:422` faengt nicht, und `instrumentation.ts:854` faengt
 * ihn erst oben: der GANZE 5-Minuten-Zyklus stirbt, mit einem Telegram-Alarm,
 * dessen Text auf unseren Code zeigt statt auf das Feld des Modells.
 *
 * WARUM HIER UND NICHT IN DER ENGINE. `ai-analysis-engine.ts` ist eine Datei
 * mit erhoehtem Risiko. Eine reine Funktion ohne Seiteneffekte laesst sich
 * RECHNEND pruefen, waehrend ein Ausdruck in der Objektliteral-Zeile nur
 * strukturell pruefbar waere — und "ein Regex prueft den Wortlaut, nicht das
 * Verhalten" (30.09.). Dieselbe Begruendung wie bei `htmlSicher` (31.10.),
 * `alterStunden` (08.11.) und `risiko` (15.11.).
 *
 * WAS HIER NICHT GEPRUEFT WIRD, mit Grund:
 *
 *  - `riskScore` ist seit dem 07.09. am Aufrufort geriegelt
 *    (`typeof === "number" && Number.isFinite`) und faellt bei Unbrauchbarkeit
 *    auf `simulateClaude`. Diese Funktion bekommt ihn deshalb als `number`
 *    herein und rechnet nur mit ihm.
 *  - `rrGemessen` wird UNVERAENDERT durchgereicht. Es ist `realesChanceRisiko`
 *    am echten Einstieg — eine Messung, kein Rueckfallwert —, und die Funktion
 *    dort ist selbst geriegelt (`risiko > 0`, Stop/Ziel auf der richtigen
 *    Seite, sonst `0`). Es zu klemmen waere eine Verhaltensaenderung an einer
 *    Stelle, die nicht zur Frage gehoert.
 */

// Ein Risikosatz ist ein Risikosatz: `maxRiskPercent` geht durch DIESELBE
// Lesart wie `riskPercent` in beiden Order-Routen und in `calcPositionSize`
// (15.11.). Eine vierte Fassung waere eine vierte Wahrheit.
import { lesbaresRisiko } from "../risiko/risiko";

export interface GeleseneKiFelder {
  /** Risikosatz in Prozent — immer eine endliche Zahl > 0. */
  maxRiskPercent: number;
  /** Chance/Risiko — die Zahl des Modells, sonst die GEMESSENE. */
  rewardRiskRatio: number;
  /** Begruendung — immer eine Zeichenkette, notfalls leer. */
  reasoning: string;
  /** Was das Modell SELBST geurteilt hat — nur ein echtes Boolean. */
  eigenesUrteil: boolean | undefined;
  /**
   * Felder, die VORHANDEN aber UNBRAUCHBAR waren, mit Rohwert.
   *
   * Nur diese Liste, nicht die fehlenden: ein weggelassenes Feld ist der
   * normale Fall eines Sprachmodells, ein unbrauchbares ist der Befund.
   * Gemessen, warum das zaehlt: Claude wird nur fuer Maerkte ueber der
   * Confidence-Untergrenze gefragt (rund sieben je Zyklus), eine Zeile je
   * fehlendem Feld waere also bis zu 2000 Zeilen am Tag — und dann schaltet
   * man das Log ab. Dieselbe Begruendung wie bei den Drosseln.
   */
  ersetzt: string[];
}

/** Rohwert fuer eine Meldung — kurz, ohne Wurf, und `NaN` bleibt `NaN`. */
function zeige(v: unknown): string {
  // NICHT `JSON.stringify`: das macht aus NaN und Infinity beides `null`, und
  // damit waere "kaputter Wert" von "kein Wert" nicht zu unterscheiden —
  // ausgerechnet im interessanten Fall (Lehre 14.11.).
  if (typeof v === "string") return `"${v.slice(0, 40)}"`;
  if (v === null) return "null";
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === "object") return "Objekt";
  return `${String(v)} (${typeof v})`;
}

/**
 * Die vier Felder des Claude-Urteils lesen, die kein Riegel hatte.
 *
 * `roh` ist das Ergebnis von `parseJSON` — absichtlich `unknown` je Feld,
 * damit `tsc` keinen Typ behauptet, den der Cast nicht halten kann.
 *
 * @param rrGemessen `realesChanceRisiko` am echten Einstieg (unveraendert
 *        durchgereicht, wenn das Modell keine brauchbare Zahl liefert).
 * @param riskScore  der bereits geriegelte Risiko-Score des Modells.
 */
export function kiFelderLesen(
  roh: {
    maxRiskPercent?: unknown;
    rewardRiskRatio?: unknown;
    reasoning?: unknown;
    approved?: unknown;
  },
  rrGemessen: number,
  riskScore: number,
): GeleseneKiFelder {
  const ersetzt: string[] = [];

  // ── 1) maxRiskPercent ───────────────────────────────────────────────────
  //
  // Fehlt der Wert oder ist er unbrauchbar, wird er aus dem GEMESSENEN
  // riskScore abgeleitet — mit genau derselben Ableitung, die
  // `simulateClaude` benutzt (`riskScore > 60 ? 0.5 : 1.0`). Damit ist es
  // abgeleitet statt erfunden, und die fruehere `?? 1.0` ist weg: die war
  // eine ZWEITE Quelle fuer den Standard-Risikosatz neben
  // `maxRiskPerTradePct` in den Einstellungen.
  const risiko = lesbaresRisiko(roh.maxRiskPercent);
  const maxRiskPercent = risiko ?? (riskScore > 60 ? 0.5 : 1.0);
  if (risiko === null && roh.maxRiskPercent !== undefined && roh.maxRiskPercent !== null) {
    ersetzt.push(`maxRiskPercent=${zeige(roh.maxRiskPercent)} -> ${maxRiskPercent} abgeleitet`);
  }

  // ── 2) rewardRiskRatio ──────────────────────────────────────────────────
  //
  // Ein Verhaeltnis ist nur als endliche Zahl GROESSER ALS 0 brauchbar; 0
  // oder negativ ist kein Chance/Risiko. Dieselbe Pruefung ausgeschrieben
  // statt `lesbaresRisiko` wiederzuverwenden: ein Verhaeltnis ist kein
  // Prozentsatz, und eine Funktion, die zwei Dinge heisst, macht beim
  // naechsten Lesen Arbeit (dieselbe Entscheidung wie Kontostand/Risiko).
  const rrRoh = roh.rewardRiskRatio;
  const rrBrauchbar = typeof rrRoh === "number" && Number.isFinite(rrRoh) && rrRoh > 0;
  const rewardRiskRatio = rrBrauchbar ? rrRoh : rrGemessen;
  if (!rrBrauchbar && rrRoh !== undefined && rrRoh !== null) {
    ersetzt.push(`rewardRiskRatio=${zeige(rrRoh)} -> ${rewardRiskRatio} gemessen`);
  }

  // ── 3) reasoning ────────────────────────────────────────────────────────
  //
  // Nur eine Zeichenkette. Ein Objekt hier hat `.slice` nicht und WIRFT eine
  // Zeile spaeter im Log; dazu rendert `MarketScannerPanel.tsx:429` den Wert
  // direkt, und ein Objekt als React-Kind reisst die ganze Ansicht.
  const grundRoh = roh.reasoning;
  const reasoning = typeof grundRoh === "string" ? grundRoh : "";
  if (typeof grundRoh !== "string" && grundRoh !== undefined && grundRoh !== null) {
    ersetzt.push(`reasoning=${zeige(grundRoh)} -> leer`);
  }

  // ── 4) eigenesUrteil ────────────────────────────────────────────────────
  //
  // Reine Diagnose, es wird nichts damit entschieden — aber `parsed.approved`
  // wurde ungeprueft uebernommen, und ein `"yes"` stand dann als
  // `Claude selbst: approved=yes` im Log. Eine Diagnose, die einen fremden
  // Wert als Urteil ausgibt, ist keine.
  const urteilRoh = roh.approved;
  const eigenesUrteil = typeof urteilRoh === "boolean" ? urteilRoh : undefined;
  if (typeof urteilRoh !== "boolean" && urteilRoh !== undefined && urteilRoh !== null) {
    ersetzt.push(`approved=${zeige(urteilRoh)} -> unbekannt`);
  }

  return { maxRiskPercent, rewardRiskRatio, reasoning, eigenesUrteil, ersetzt };
}
