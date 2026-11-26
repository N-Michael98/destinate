// ── ZYKLUS-BILANZ: WO STERBEN DIE SIGNALE — UEBER ALLE ZYKLEN (16.09.) ──────
//
// ANLASS. Am 16.09. liess sich EIN Zyklus aus dem Log Zeile fuer Zeile
// abgleichen (GPT 25/3/2 -> 2 Vetos -> 3 unter 70 -> 0 GO). Das war n=1. Ob
// die Confidence, das R/R, die Meta-KI oder die Schwelle das eigentliche
// Nadeloehr ist, laesst sich nur ueber VIELE Zyklen sagen — und dafuer gab es
// nichts: jede Stufe schrieb ihre eigene Logzeile, niemand zaehlte zusammen.
//
// WIE. Dieses Modul ist ein EMPFAENGER am Agent-Bus (seit 16.09. auf
// `global`). Die Stufen melden, was sie entschieden haben — der Orchestrator
// Anfang und Ende des Zyklus, der Analyse-Agent den Scan, jedes Tor seine
// Entscheidung, der Ausfuehrungs-Agent Erfolg und Fehlschlag. Hier kommt es
// zusammen: eine Zeile pro Zyklus und eine Tagessumme in Redis, die nach
// Handelsschluss per Telegram rausgeht — AUCH an Tagen ohne Trade.
//
// WAS ES NICHT TUT: es entscheidet nichts, sperrt nichts und veraendert keinen
// Wert, den der Handel liest. Jede Funktion hier wirft nie nach aussen.

export type Richtungen = { WAIT: number; BUY: number; SELL: number };

/** Was der Scan ueber sich meldet (vom Analyse-Agenten, nur im Handelszyklus). */
export type ScanDaten = {
  maerkte: number;
  gpt: Richtungen;
  vetos: number;
  stilVerworfen: number;
  /** Confidence der Richtungssignale, die unter der Untergrenze lagen. */
  unterGrenze: number[];
  go: number;
  rrAbgelehnt: number;
  /** Richtung UND Confidence waren da, aber GPT lieferte keinen Stop oder kein
   *  Ziel (20.09.). Diese Signale sind weder GO noch an der Freigabe
   *  gescheitert — ohne eigene Zahl verschwinden sie aus der Rechnung. */
  ohneStopZiel: number;
  /** ── DIE STUFE, DIE VOR ALLEN ANDEREN KOMMT (22.09.) ────────────────────
   *
   *  Richtungssignale, die an `hasFullData` starben: TA-Lib oder der
   *  Strategie-Konsens fehlte fuer DIESES Symbol. Gezaehlt wird genau die
   *  Bedingung, die auch die 🔒-Zeile ins Log schreibt — die Zahl hier und
   *  die Zahl der 🔒-Zeilen sind deshalb immer gleich.
   *
   *  GEFUNDEN am Zyklus vom 22.09. 21:17: das Strategien-Backend antwortete
   *  mit 502, `fetchStrategySignals` gab eine leere Map zurueck, und damit
   *  fiel `strategienOk` fuer ALLE 30 Maerkte. GPT hatte acht
   *  Richtungssignale geliefert; es folgten acht 🔒-Zeilen und GO 0.
   *
   *  Die Bilanzzeile meldete dazu: "GPT 22W/5B/3S | Veto 0 | <Grenze 2 |
   *  Freigabe-Nein 0 | GO 0". Sechs der acht Signale waren damit weder
   *  freigegeben noch an irgendeiner genannten Stufe gescheitert — sie
   *  verschwanden. In der Tagesbilanz stuende an so einem Abend "60 BUY ·
   *  36 SELL … GO: 0" ohne ein Wort zur Ursache, und man laese es als
   *  "die KI wollte nicht" statt als "das Backend war weg".
   *
   *  Exakt die Fehlerklasse, die `ohneStopZiel` am 20.09. geschlossen hat —
   *  eine Stufe weiter vorne. */
  ohneVolleDaten: number;
  /** Was gefehlt hat, nach Grund ("Strategien", "TA-Lib", "TA-Lib+Strategien").
   *  Die blosse Anzahl sagt nicht, WELCHER Dienst ausgefallen ist — und genau
   *  das ist die Frage, mit der man ins Railway-Log steigt. */
  ohneVolleDatenGrund: Record<string, number>;
  /** Maerkte, fuer die GPT GAR NICHT geantwortet hat (30.10.).
   *  Bis dahin als WAIT gezaehlt — ein Ausfall gab sich als Urteil aus. */
  ohneGptAntwort: number;
  /** WARUM sie fehlten (23.11.) — `gptZyklusLage()` in der Engine:
   *  ok / nicht-gefragt / gescheitert / abgeschnitten / unlesbar / ausgelassen.
   *  `gptLageGeprueft` ist 1 je Scan, der das gemessen hat — eine Summe von
   *  vor dem Deploy kennt es nicht und darf keine Aufschluesselung behaupten. */
  gptLage: string;
  gptLageGrund: string;
  gptLageGeprueft: number;
  /** Maerkte, fuer die GPT eine Zahl geschickt hat, die KEINE brauchbare
   *  ist (15.11.) — Text, Objekt, `Infinity`, Confidence ausserhalb
   *  0..100. Ohne eigene Zahl stirbt so ein Signal an `ohneStopZiel`
   *  bzw. an der Confidence-Grenze und ist dort von einem URTEIL nicht
   *  zu unterscheiden. Dieselbe Fehlerklasse wie `ohneGptAntwort`. */
  /** ── JEDES SIGNAL GENAU EINER STUFE (19.11.) ─────────────────────────
   *
   *  Siehe `trichterZuordnung()` in der Engine. `konsensRichtungen` und
   *  `taErsatzRichtungen` sind Richtungssignale, die NICHT unter `gpt`
   *  stehen — ohne sie kann keine Summe aufgehen. Die vier `rest…`/
   *  `mehrfach…` zaehlen Signale, die an KEINER bzw. an MEHR ALS EINER
   *  Stufe gezaehlt wurden. `trichterGeprueft` ist 1 je Scan, der die
   *  Zuordnung gemacht hat — eine Summe von vor dem 19.11. kennt sie nicht,
   *  und „geprueft" darf sie nicht behaupten. */
  gptZahlUnbrauchbar: number;
  /** Signale, die NUR an Claudes Veto `maxRiskPercent: 0` scheiterten
   *  (24.11.) — R/R und Risiko-Score haetten sie freigegeben. Teilmenge von
   *  `rrAbgelehnt`, keine eigene Stufe. `claudeNullGeprueft` ist 1 je Scan,
   *  der das misst; eine Summe von vor dem Deploy kennt es nicht. */
  claudeNullAllein: number;
  claudeNullGeprueft: number;
  /** GPT liess Maerkte aus — EINMAL nachgefragt (25.11.). `gptNachfragen` ist
   *  0/1 je Scan, `gptNachgefragt`/`gptNachgeholt` zaehlen Maerkte.
   *  `ohneGptAntwort` ist der Endstand DANACH. `gptNachfrageGeprueft` ist 1
   *  je Scan, der das misst; eine Summe von vor dem Deploy kennt es nicht. */
  gptNachfragen: number;
  gptNachgefragt: number;
  gptNachgeholt: number;
  gptNachfrageGeprueft: number;
  /** Schattenbuch (25.11.): je Richtungssignal die Stufe und die Werte aus
   *  GPT. OPTIONAL: ein Scan von vor dem Deploy kennt es nicht. Geht NICHT in
   *  die Tagessumme, sondern ins Schattenbuch (`lib/schattenbuch/`). */
  schatten?: unknown[];
  konsensRichtungen: number;
  taErsatzRichtungen: number;
  trichterGeprueft: number;
  restOhneAnalyse: number;
  restOhneStop: number;
  restUngeklaert: number;
  mehrfachGezaehlt: number;
  claudeGefragt: number;
  /** GPT-Antworten, die dem eigenen Prompt widersprechen — Anzahl je Art. */
  regelbrueche: Record<string, number>;
  dauerMs: Record<string, number>;
  /** Was im Prompt wirklich drinstand. `performance` ist am 17.09. entfallen —
   *  es war ein EURUSD-Backtest, der fuer alle 30 Maerkte eingespielt wurde. */
  kontext: { news: boolean; mtfSymbole: number };
};

export type TorEintrag = {
  gate: string;
  symbol?: string;
  approve: boolean;
  reason: string;
  fallback?: boolean;
  /** Die Confidence, mit der dieses Tor entschieden hat (02.11.).
   *
   *  GEFUNDEN BEIM GEGENLESEN des /status vom 02.11. 23:16: das Tor
   *  meldete `Confidence # < Schwelle # (38)` — `grundSchluessel()`
   *  ersetzt jede Zahl durch `#`, richtig fuers Zaehlen. Damit fehlte
   *  genau die Zahl, an der die Entscheidung haengt (die Vor-Tor-Stufe
   *  zeigt ihre Spanne laengst: `86 (52-69)`).
   *
   *  DIE ZAHL LAG BEREITS AUF DEM BUS. `GateDecisionPayload.confidence`
   *  gibt es seit der Einfuehrung des Typs, und VIER Stellen senden sie
   *  (orchestrator-agent.ts:1077/1084, execution-agent.ts:208/227).
   *  Gelesen hat sie NIEMAND — `bilanzVerbuchen` ist der einzige
   *  Abonnent von `GATE:DECISION` und hat das Feld fallen lassen.
   *  Das ist "ein Feld ohne Empfaenger" (28.10.), nur in der
   *  Gegenrichtung zu "ein Abo ohne Sender" (17.09.). */
  confidence?: number;
  /** BUY oder SELL — welche Seite dieses Tor abgelehnt hat (02.11.).
   *
   *  ZWEITER FUND DESSELBEN RIEGELS. Nachdem `confidence` gelesen wird,
   *  meldete die neue Gegenrichtungs-Pruefung sofort `direction`: auch
   *  sie wird von jeder Tor-Stelle gesendet und war nirgends gelesen.
   *
   *  Nicht als Ausnahme eingetragen, sondern BENUTZT — die Zahl ist
   *  brauchbar: `/hebel` misst auf echten Trades EW +0.76 fuer SELL
   *  gegen -3.41 fuer BUY. Welche Seite ein Tor wegwirft, gehoert
   *  deshalb sichtbar. */
  direction?: string;
};

export type ZyklusBilanz = {
  start: number;
  ende?: number;
  ausgang?: string;
  scan?: ScanDaten;
  tore: TorEintrag[];
  trades: string[];
  fehlgeschlagen: string[];
};

/** Die Spanne der Confidence je Ablehnungsgrund (02.11.).
 *
 *  OPTIONAL MIT ABSICHT: eine Tagessumme von gestern kennt das Feld
 *  nicht. Dieselbe Vorsicht wie bei `ohneStopZiel` und
 *  `ohneGptAntwort` — ohne sie waere die erste Summe nach dem Deploy
 *  kaputt. Fehlt sie, wird KEINE Spanne gezeigt (nicht 0-0: das waere
 *  eine Behauptung statt einer Messung). */
export type ConfSpanne = { min: number; max: number };

export type TorSumme = { ja: number; nein: number; fallback: number; gruende: Record<string, number>;
  confSpanne?: Record<string, ConfSpanne>;
  /** Abgelehnte Richtungen je Tor. Optional wie `confSpanne`: eine
   *  Summe von gestern kennt das Feld nicht. */
  richtungen?: Record<string, number>;
  /** ── DIE ANDERE SEITE (04.11.) ───────────────────────────────────────
   *
   *  ZUGESTIMMTE Richtungen je Tor. `direction` wird von jeder
   *  `meldeTorEntscheidung`-Stelle gesendet — bei `approve: true` ebenso
   *  wie bei `false` (nachgezaehlt: je Tor zwei Aufrufe, beide mit
   *  Richtung) — und `TorEintrag.direction` speichert sie auch in beiden
   *  Faellen. Gelesen wurde sie nur im `else`-Zweig.
   *
   *  WAS DAMIT NICHT ZU BEANTWORTEN WAR: `/status` vom 04.11. zeigte 79
   *  Ablehnungen nach dem GO, davon 67 SELL (85 %) — und `/hebel` misst
   *  SELL als die EINZIGE Richtung mit positivem Erwartungswert (+0.75
   *  gegen BUY -3.41). Ob die Tore eine Seite BEVORZUGT wegwerfen oder nur
   *  die Mischung der Signale abbilden, liess sich NICHT entscheiden: die
   *  Richtungsaufteilung der 80 GO stand nirgends.
   *
   *  Sie steht jetzt hier. Das erste Tor nach dem GO (Meta-KI) sieht JEDES
   *  GO-Signal — `ja + nein` dort IST die GO-Aufteilung.
   *
   *  Dieselbe Fehlerklasse wie `confidence` am 02.11., nur in der halben
   *  Form: ein Feld, das gesendet und gespeichert, aber nur auf einer
   *  Seite gelesen wird. Optional aus demselben Grund wie `richtungen`. */
  richtungenJa?: Record<string, number> };

export type Tagessumme = {
  datum: string;
  zyklen: number;
  ausgaenge: Record<string, number>;
  scans: number;
  maerkte: number;
  gpt: Richtungen;
  vetos: number;
  stilVerworfen: number;
  unterGrenze: number;
  confMin: number | null;
  confMax: number | null;
  go: number;
  rrAbgelehnt: number;
  ohneStopZiel: number;
  /** Siehe ScanDaten.ohneVolleDaten (22.09.) — ohne diese Zahl meldet die
   *  Tagesbilanz einen Backend-Ausfall als "die KI wollte nicht". */
  ohneVolleDaten: number;
  ohneVolleDatenGrund: Record<string, number>;
  /** Siehe ScanDaten.ohneGptAntwort (30.10.). */
  ohneGptAntwort: number;
  /** Siehe ScanDaten.gptZahlUnbrauchbar (15.11.). */
  gptZahlUnbrauchbar: number;
  /** Siehe ScanDaten.claudeNullAllein (24.11.). */
  claudeNullAllein: number;
  claudeNullGeprueft: number;
  /** Siehe ScanDaten.gptNachfragen … gptNachfrageGeprueft (25.11.). */
  gptNachfragen: number;
  gptNachgefragt: number;
  gptNachgeholt: number;
  gptNachfrageGeprueft: number;
  /** Siehe ScanDaten.konsensRichtungen … mehrfachGezaehlt (19.11.). */
  konsensRichtungen: number;
  taErsatzRichtungen: number;
  trichterGeprueft: number;
  restOhneAnalyse: number;
  restOhneStop: number;
  restUngeklaert: number;
  mehrfachGezaehlt: number;
  claudeGefragt: number;
  /** Broker-Fehler nach Grund — die Zahl allein sagt nicht, WARUM (20.09.). */
  fehlgeschlagenGruende: Record<string, number>;
  /** Maerkte OHNE GPT-Antwort je Lage, und die Gruende je Zyklus (23.11.).
   *  Siehe ScanDaten.gptLage. */
  ohneGptJeLage: Record<string, number>;
  gptAusfallGruende: Record<string, number>;
  gptLageGeprueft: number;
  /** Wie oft News im Prompt standen, und die Summe der Symbole MIT 1H/1W. */
  newsZyklen: number;
  mtfSumme: number;
  regelbrueche: Record<string, number>;
  tore: Record<string, TorSumme>;
  trades: number;
  fehlgeschlagen: number;
  dauerSummeMs: number;
  dauerMaxMs: number;
};

/** Obergrenzen, damit weder die Zyklus- noch die Tagesbilanz unbegrenzt waechst. */
/**
 * AUSGERECHNET, nicht geschaetzt (02.11.).
 *
 * Seit dem 02.11. meldet JEDES Kandidaten-Tor beide Richtungen. Damit
 * steigt die Zahl der Ereignisse je Zyklus deutlich:
 *
 *   30 Maerkte (Watchlist) x 7 Tore je Kandidat        = 210
 *   + Meta-KI (eine Meldung je GO-Signal, max 30)      =  30
 *   + Orchestrator-KI und Zyklus-Limit                 =   2
 *                                                      = 242
 *
 * Mit 200 waere der Deckel GENAU jetzt zugeschnappt — und was
 * wegfaellt, sind die SPAETEN Tore (Filterkette, Override,
 * Ausfuehrungs-KI), also die interessantesten. Ein Deckel, der die
 * Ablehnungen verdraengt, waere schlimmer als keiner.
 *
 * 400 laesst Luft fuer eine groessere Watchlist; `safety-nets` rechnet
 * die Schranke aus der QUELLE nach und wird rot, wenn sie bricht.
 */
/** Exportiert, damit der Pruefstand die Schranke aus der QUELLE nimmt
 *  statt eine Zahl einzufrieren (02.11.). */
export const MAX_TORE_JE_ZYKLUS = 400;
const MAX_GRUENDE_JE_TOR = 25;
const MAX_TEXT = 160;

export function neueBilanz(start: number): ZyklusBilanz {
  return { start, tore: [], trades: [], fehlgeschlagen: [] };
}

const zahl = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const text = (x: unknown): string => String(x ?? "").slice(0, MAX_TEXT);

/**
 * Einen Grund zum ZAEHLEN vereinheitlichen: Zahlen weg, sonst waere
 * "Confidence 74 < Schwelle 76" und "Confidence 73 < Schwelle 76" je ein
 * eigener Grund und die Tagessumme zerfiele in Einzelfaelle.
 */
/** Obergrenze des Gruppierungs-Schluessels. */
export const GRUND_MAX = 80;
/** Wie viele Zeichen ein GPT-Ausfallgrund in der Tagesbilanz zeigt (23.11.) —
 *  gemessen NACH dem Entschaerfen, siehe `entschaerftGekuerzt`. */
export const GPT_GRUND_MAX_BILANZ = 90;
/** Unter so viel Zeichen wird NICHT an der Wortgrenze gekuerzt — sonst
 *  bliebe von einem Grund ohne fruehes Leerzeichen fast nichts uebrig. */
export const GRUND_MIN_WORT = 40;

export function grundSchluessel(grund: string): string {
  const roh = text(grund)
    .replace(/\([^)]*\)/g, "")          // Klammerzusaetze (Einstellungswerte u. ae.)
    .replace(/-?\d+(?:[.,]\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim();
  if (roh.length <= GRUND_MAX) return roh || "ohne Grund";
  // AN DER WORTGRENZE SCHNEIDEN (02.11.). Der harte Schnitt traf am
  // 02.11. live mitten ins Wort: "... aber TA-Signal ze" — nachgezaehlt
  // exakt 80 Zeichen. Eine Diagnose, die im interessanten Fall
  // abbricht, ist die Fehlerklasse "im interessanten Fall nicht
  // schweigen", angewandt auf die Messung selbst.
  //
  // DETERMINISTISCH, damit das Gruppieren unberuehrt bleibt: derselbe
  // Grund ergibt denselben Schnitt und faellt weiter zusammen.
  const schnitt = roh.slice(0, GRUND_MAX - 1);
  const letzte = schnitt.lastIndexOf(" ");
  const kurz = letzte >= GRUND_MIN_WORT ? schnitt.slice(0, letzte) : schnitt;
  return kurz + "\u2026";
}

/** Die Confidence-Spanne als Text — leer, wenn nichts zu melden ist.
 *
 *  Eine fehlende Spanne ergibt KEINE Zahl. Dieselbe Regel wie beim
 *  Kurs-Alter (22.09.) und bei `exitPosition` (27.10.): eine stille
 *  Ersatzzahl macht aus "nicht gemessen" eine Messung. */
/** Die abgelehnten Richtungen als Text — leer, wenn nichts da ist.
 *  Nach Menge sortiert, damit die haeufigere Seite vorne steht. */
export function richtungText(
  r: Record<string, number> | undefined,
  /** `true` setzt die Aufteilung in Klammern DIREKT hinter ihre Seite
   *  (`64 ja (41 SELL/23 BUY)`) statt hinten an die Zeile. Standard ist
   *  `false` — die alte Form bleibt damit Zeichen fuer Zeichen gleich, und
   *  nur SO ist die Zeile ueberhaupt eindeutig: bis zum 04.11. stand
   *  `64 ja · 16 nein · 12 SELL/4 BUY`, und die Aufteilung las sich, als
   *  beschriebe sie alle 80. */
  klammer = false,
  /**
   * DIE ZAHL DER SEITE (`ja` bzw. `nein`) — und warum sie hier steht (04.11.).
   *
   * AUSGEFUEHRT BELEGT, nicht vermutet: die Tagessumme eines Tages liegt in
   * Redis, und `tagessummeAddieren` uebernimmt die gespeicherten `ja`-Zaehler.
   * Wird `richtungenJa` mitten am Tag eingefuehrt, zaehlt `ja` den GANZEN Tag,
   * die Aufteilung aber nur ab dem Deploy. Gemessen am Uebergang vom 04.11.:
   *
   *     Meta-KI: 67 ja (2 SELL/1 BUY)
   *
   * Die Klammer beschreibt **3** von 67 — und liest sich wie alle 67. Das ist
   * genau die Mehrdeutigkeit, die an diesem Tag behoben wurde, einen Tag
   * weiter gedacht. Sie verschwindet um 00:00 UTC von selbst, aber sie tritt
   * wieder auf, sobald ein Tor seine Richtung nur auf EINEM Zweig sendet.
   *
   * Deckt die Aufteilung ihre Seite nicht ab, wird gesagt, wie viele sie
   * beschreibt. `undefined` heisst „nicht vergleichen" — damit bleibt die
   * alte Form unveraendert.
   */
  seitenZahl?: number,
): string {
  const e = Object.entries(r ?? {}).filter(([, n]) => Number.isFinite(n) && n > 0);
  if (e.length === 0) return "";
  e.sort((a, b) => b[1] - a[1]);
  const kern = e.map(([d, n]) => `${n} ${d}`).join("/");
  const summe = e.reduce((s, [, n]) => s + n, 0);
  const vollstaendig = seitenZahl === undefined
    || !Number.isFinite(seitenZahl) || summe >= seitenZahl;
  const inhalt = vollstaendig ? kern : `davon ${summe} mit Richtung: ${kern}`;
  return klammer ? ` (${inhalt})` : ` · ${inhalt}`;
}

export function confText(sp: ConfSpanne | undefined): string {
  if (!sp || !Number.isFinite(sp.min) || !Number.isFinite(sp.max)) return "";
  return sp.min === sp.max
    ? ` · Confidence ${sp.min}`
    : ` · Confidence ${sp.min}\u2013${sp.max}`;
}

/** Ein Bus-Ereignis in die laufende Bilanz uebernehmen. Unbekanntes wird ignoriert. */
export function bilanzVerbuchen(
  b: ZyklusBilanz,
  ev: { type: string; payload?: Record<string, unknown> },
): void {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case "ANALYSIS:SCAN_DONE": {
      const s = p.scan as ScanDaten | undefined;
      if (s && typeof s === "object") b.scan = s;
      break;
    }
    case "GATE:DECISION": {
      if (b.tore.length >= MAX_TORE_JE_ZYKLUS) break;
      if (typeof p.gate !== "string" || typeof p.approve !== "boolean") break;
      b.tore.push({
        gate: p.gate,
        symbol: typeof p.symbol === "string" ? p.symbol : undefined,
        approve: p.approve,
        reason: text(p.reason),
        fallback: p.fallback === true,
        // Nur eine ENDLICHE Zahl. Ein NaN faellt sonst durch jeden
        // Vergleich und landete in Math.min/max als NaN — dieselbe
        // Falle wie `rrBand(NaN)` am 29.10.
        confidence: typeof p.confidence === "number" && Number.isFinite(p.confidence)
          ? p.confidence : undefined,
        direction: typeof p.direction === "string" && p.direction.trim() !== ""
          ? p.direction.trim().toUpperCase() : undefined,
      });
      break;
    }
    case "EXECUTION:TRADE_OPENED":
      if (b.trades.length < MAX_TORE_JE_ZYKLUS) b.trades.push(`${text(p.symbol)} ${text(p.direction)}`.trim());
      break;
    case "EXECUTION:TRADE_FAILED":
      if (b.fehlgeschlagen.length < MAX_TORE_JE_ZYKLUS) b.fehlgeschlagen.push(`${text(p.symbol)}: ${text(p.grund)}`);
      break;
  }
}

/** Signale, die an KEINER oder an MEHR ALS EINER Stufe gezaehlt wurden —
 *  `null`, wenn es keine gibt (19.11.). EINE Formulierung fuer Zyklus-Zeile
 *  und Tagesbilanz, damit beide dasselbe sagen. */
export function trichterRestText(s: {
  restOhneAnalyse?: number; restOhneStop?: number;
  restUngeklaert?: number; mehrfachGezaehlt?: number;
}): string | null {
  const teile: string[] = [];
  if (zahl(s.restOhneAnalyse) > 0) teile.push(`ohne echte Analyse ${zahl(s.restOhneAnalyse)}`);
  if (zahl(s.restOhneStop) > 0) teile.push(`unter Grenze ohne Stop ${zahl(s.restOhneStop)}`);
  if (zahl(s.restUngeklaert) > 0) teile.push(`ungeklaert ${zahl(s.restUngeklaert)}`);
  if (zahl(s.mehrfachGezaehlt) > 0) teile.push(`doppelt gezaehlt ${zahl(s.mehrfachGezaehlt)}`);
  return teile.length > 0 ? teile.join(", ") : null;
}

/** Die Zeile pro Zyklus. */
export function bilanzZeile(b: ZyklusBilanz): string {
  const dauer = b.ende !== undefined ? Math.round((b.ende - b.start) / 1000) : null;
  const teile: string[] = [`Ausgang: ${b.ausgang ?? "?"}`];
  if (dauer !== null) teile.push(`${dauer}s`);
  const s = b.scan;
  if (s) {
    const conf = s.unterGrenze.length > 0
      ? ` (${Math.min(...s.unterGrenze)}–${Math.max(...s.unterGrenze)})`
      : "";
    teile.push(`GPT ${s.gpt.WAIT}W/${s.gpt.BUY}B/${s.gpt.SELL}S`);
    // Ohne diese Zahl bleibt „30W" mehrdeutig: dreissig WAIT-URTEILE oder
    // dreissig ausgebliebene Antworten (30.10.). Nur bei > 0, wie bei
    // `stilVerworfen` und `ohneStopZiel` — eine 0 waere nur Rauschen.
    // 23.11.: und WARUM — sonst ist „ohne Antwort" wieder mehrdeutig.
    if (zahl(s.ohneGptAntwort) > 0) {
      teile.push(`ohne GPT-Antwort ${s.ohneGptAntwort}`
        + (typeof s.gptLage === "string" && s.gptLage ? ` (${s.gptLage}: ${text(s.gptLageGrund).slice(0, 120)})` : ""));
    }
    // 25.11.: nur wenn nachgefragt wurde — sonst waere es Rauschen.
    if (zahl(s.gptNachgefragt) > 0) {
      teile.push(`GPT-Nachfrage ${zahl(s.gptNachgeholt)}/${zahl(s.gptNachgefragt)} nachgeholt`);
    }
    // Nur bei > 0, wie die Zeile darueber — eine 0 waere Rauschen.
    if (zahl(s.gptZahlUnbrauchbar) > 0) {
      teile.push(`GPT-Zahl unbrauchbar ${s.gptZahlUnbrauchbar}`);
    }
    teile.push(`Veto ${s.vetos}`);
    if (s.stilVerworfen > 0) teile.push(`Stil ${s.stilVerworfen}`);
    // Vor `<Grenze`, weil das Daten-Tor im Trichter VOR der Confidence steht:
    // ein Symbol ohne vollstaendige Daten wird gar nicht erst gefragt.
    if (zahl(s.ohneVolleDaten) > 0) {
      const gruende = Object.entries(s.ohneVolleDatenGrund ?? {})
        .filter(([, n]) => zahl(n) > 0)
        .sort((a, b) => zahl(b[1]) - zahl(a[1]))
        .map(([k, n]) => `${k} ${zahl(n)}`)
        .join(", ");
      teile.push(`ohne Daten ${zahl(s.ohneVolleDaten)}${gruende ? ` (${gruende})` : ""}`);
    }
    teile.push(`<Grenze ${s.unterGrenze.length}${conf}`);
    // 24.11.: wie viele davon NUR an Claudes Veto (maxRiskPercent 0) — nur bei > 0.
    teile.push(`Freigabe-Nein ${s.rrAbgelehnt}`
      + (zahl(s.claudeNullAllein) > 0 ? ` (nur Claude-Risiko 0: ${s.claudeNullAllein})` : ""));
    if (zahl(s.ohneStopZiel) > 0) teile.push(`ohne Stop/Ziel ${s.ohneStopZiel}`);
    teile.push(`GO ${s.go}`);
    // 19.11.: Signale ausserhalb von `gpt` und Signale ohne genau EINE Stufe.
    // Nur bei > 0 — im gesunden Zyklus waere jede Zeile Rauschen.
    if (zahl(s.konsensRichtungen) > 0) teile.push(`Konsens ${s.konsensRichtungen}`);
    if (zahl(s.taErsatzRichtungen) > 0) teile.push(`TA-Ersatz ${s.taErsatzRichtungen}`);
    const rest = trichterRestText(s);
    if (rest) teile.push(`Trichter-Rest: ${rest}`);
    const brueche = Object.entries(s.regelbrueche).filter(([, n]) => n > 0);
    if (brueche.length > 0) teile.push(`Regelbruch GPT: ${brueche.map(([k, n]) => `${k} ${n}`).join(", ")}`);
    // Was im Prompt wirklich drinstand (17.09.). Bis heute wurde `kontext`
    // gemessen und NIRGENDS ausgegeben — eine Zahl, die niemand sieht, ist
    // keine Messung. Faellt der Multi-Timeframe-Abruf aus, urteilt GPT auf 1D
    // allein; genau das soll man dem Zyklus ansehen.
    const k = s.kontext;
    if (k) teile.push(`Kontext: News ${k.news ? "ja" : "nein"}, MTF ${zahl(k.mtfSymbole)}/${zahl(s.maerkte)}`);
    const d = s.dauerMs;
    const dauerText = Object.entries(d).map(([k2, v]) => `${k2} ${Math.round(v / 1000)}s`).join(" ");
    if (dauerText) teile.push(`Dauer: ${dauerText}`);
  }
  for (const t of b.tore.filter((t) => !t.approve || t.fallback)) {
    teile.push(`${t.gate}${t.fallback ? " (Rueckfall)" : " nein"}${t.symbol ? ` ${t.symbol}` : ""}: ${t.reason}`);
  }
  if (b.trades.length > 0) teile.push(`TRADES: ${b.trades.join(", ")}`);
  if (b.fehlgeschlagen.length > 0) teile.push(`Broker-Fehler: ${b.fehlgeschlagen.join(" ; ")}`);
  return `[zyklus] 📋 ${teile.join(" | ")}`;
}

export function leereTagessumme(datum: string): Tagessumme {
  return {
    datum, zyklen: 0, ausgaenge: {}, scans: 0, maerkte: 0,
    gpt: { WAIT: 0, BUY: 0, SELL: 0 }, vetos: 0, stilVerworfen: 0,
    unterGrenze: 0, confMin: null, confMax: null, go: 0, rrAbgelehnt: 0,
    ohneStopZiel: 0, ohneVolleDaten: 0, ohneVolleDatenGrund: {},
    ohneGptAntwort: 0, gptZahlUnbrauchbar: 0,
    claudeNullAllein: 0, claudeNullGeprueft: 0,
    gptNachfragen: 0, gptNachgefragt: 0, gptNachgeholt: 0, gptNachfrageGeprueft: 0,
    konsensRichtungen: 0, taErsatzRichtungen: 0, trichterGeprueft: 0,
    restOhneAnalyse: 0, restOhneStop: 0, restUngeklaert: 0, mehrfachGezaehlt: 0,
    claudeGefragt: 0, newsZyklen: 0, mtfSumme: 0,
    fehlgeschlagenGruende: {},
    ohneGptJeLage: {}, gptAusfallGruende: {}, gptLageGeprueft: 0,
    regelbrueche: {}, tore: {}, trades: 0, fehlgeschlagen: 0,
    dauerSummeMs: 0, dauerMaxMs: 0,
  };
}

/**
 * Eine abgeschlossene Zyklus-Bilanz zur Tagessumme addieren. Gibt eine NEUE
 * Summe zurueck; eine Summe von einem anderen Tag wird verworfen.
 */
export function tagessummeAddieren(alt: Tagessumme | null | undefined, b: ZyklusBilanz, datum: string): Tagessumme {
  const t: Tagessumme = alt && alt.datum === datum
    ? JSON.parse(JSON.stringify(alt)) as Tagessumme
    : leereTagessumme(datum);
  t.zyklen++;
  const ausgang = grundSchluessel(b.ausgang ?? "unbekannt");
  t.ausgaenge[ausgang] = (t.ausgaenge[ausgang] ?? 0) + 1;
  if (b.ende !== undefined) {
    const d = Math.max(0, b.ende - b.start);
    t.dauerSummeMs += d;
    t.dauerMaxMs = Math.max(t.dauerMaxMs, d);
  }
  const s = b.scan;
  if (s) {
    t.scans++;
    t.maerkte += zahl(s.maerkte);
    t.gpt.WAIT += zahl(s.gpt?.WAIT);
    t.gpt.BUY += zahl(s.gpt?.BUY);
    t.gpt.SELL += zahl(s.gpt?.SELL);
    t.vetos += zahl(s.vetos);
    t.stilVerworfen += zahl(s.stilVerworfen);
    const conf = (s.unterGrenze ?? []).filter((c) => Number.isFinite(c));
    t.unterGrenze += conf.length;
    for (const c of conf) {
      t.confMin = t.confMin === null ? c : Math.min(t.confMin, c);
      t.confMax = t.confMax === null ? c : Math.max(t.confMax, c);
    }
    t.go += zahl(s.go);
    t.rrAbgelehnt += zahl(s.rrAbgelehnt);
    t.ohneStopZiel = zahl(t.ohneStopZiel) + zahl(s.ohneStopZiel);
    t.ohneVolleDaten = zahl(t.ohneVolleDaten) + zahl(s.ohneVolleDaten);
    // `zahl()` auch auf den Summanden links: eine Tagessumme aus Redis
    // kann von gestern stammen und dieses Feld noch nicht haben.
    t.ohneGptAntwort = zahl(t.ohneGptAntwort) + zahl(s.ohneGptAntwort);
    // WARUM (23.11.) — mit `zahl()`/`??=` auf BEIDEN Seiten: die Summe von
    // heute frueh kennt diese Felder nicht. Verbucht wird nur, wo wirklich
    // Antworten fehlten; die Gruende zaehlen ZYKLEN, gedeckelt wie die
    // Broker-Gruende.
    t.gptLageGeprueft = zahl(t.gptLageGeprueft) + zahl(s.gptLageGeprueft);
    t.ohneGptJeLage ??= {};
    t.gptAusfallGruende ??= {};
    const gptLage = typeof s.gptLage === "string" ? s.gptLage : "";
    if (gptLage && zahl(s.ohneGptAntwort) > 0) {
      t.ohneGptJeLage[gptLage] = zahl(t.ohneGptJeLage[gptLage]) + zahl(s.ohneGptAntwort);
      const k = grundSchluessel(`${gptLage}: ${text(s.gptLageGrund)}`);
      if (t.gptAusfallGruende[k] !== undefined
        || Object.keys(t.gptAusfallGruende).length < MAX_GRUENDE_JE_TOR) {
        t.gptAusfallGruende[k] = zahl(t.gptAusfallGruende[k]) + 1;
      } else {
        t.gptAusfallGruende["(weitere)"] = zahl(t.gptAusfallGruende["(weitere)"]) + 1;
      }
    }
    // `zahl()` auf BEIDEN Seiten, aus demselben Grund wie eine Zeile
    // darueber: eine Tagessumme aus Redis kann von gestern stammen und
    // dieses Feld noch nicht kennen (15.11.).
    t.gptZahlUnbrauchbar = zahl(t.gptZahlUnbrauchbar) + zahl(s.gptZahlUnbrauchbar);
    // 24.11.: `zahl()` auf BEIDEN Seiten — die Summe von heute frueh kennt
    // diese Felder nicht.
    t.claudeNullAllein = zahl(t.claudeNullAllein) + zahl(s.claudeNullAllein);
    t.claudeNullGeprueft = zahl(t.claudeNullGeprueft) + zahl(s.claudeNullGeprueft);
    // 25.11.: `zahl()` auf BEIDEN Seiten — die Summe von heute frueh kennt
    // diese Felder nicht.
    t.gptNachfragen = zahl(t.gptNachfragen) + zahl(s.gptNachfragen);
    t.gptNachgefragt = zahl(t.gptNachgefragt) + zahl(s.gptNachgefragt);
    t.gptNachgeholt = zahl(t.gptNachgeholt) + zahl(s.gptNachgeholt);
    t.gptNachfrageGeprueft = zahl(t.gptNachfrageGeprueft) + zahl(s.gptNachfrageGeprueft);
    // 19.11.: `zahl()` auf BEIDEN Seiten — die Summe von heute frueh kennt
    // diese Felder noch nicht. `trichterGeprueft` zaehlt, WIE VIELE Scans
    // die Zuordnung gemacht haben; nur so kann /status ehrlich sagen, fuer
    // welchen Teil des Tages die Summenprobe gilt.
    t.konsensRichtungen = zahl(t.konsensRichtungen) + zahl(s.konsensRichtungen);
    t.taErsatzRichtungen = zahl(t.taErsatzRichtungen) + zahl(s.taErsatzRichtungen);
    t.trichterGeprueft = zahl(t.trichterGeprueft) + zahl(s.trichterGeprueft);
    t.restOhneAnalyse = zahl(t.restOhneAnalyse) + zahl(s.restOhneAnalyse);
    t.restOhneStop = zahl(t.restOhneStop) + zahl(s.restOhneStop);
    t.restUngeklaert = zahl(t.restUngeklaert) + zahl(s.restUngeklaert);
    t.mehrfachGezaehlt = zahl(t.mehrfachGezaehlt) + zahl(s.mehrfachGezaehlt);
    // `t.ohneVolleDatenGrund` kann fehlen, wenn die Tagessumme aus Redis noch
    // von gestern stammt (ohne dieses Feld) — derselbe Fall, den `zahl()` eine
    // Zeile tiefer fuer die Zahlen abfaengt.
    if (!t.ohneVolleDatenGrund) t.ohneVolleDatenGrund = {};
    for (const [k, n] of Object.entries(s.ohneVolleDatenGrund ?? {})) {
      t.ohneVolleDatenGrund[k] = zahl(t.ohneVolleDatenGrund[k]) + zahl(n);
    }
    t.claudeGefragt += zahl(s.claudeGefragt);
    // `zahl(...)` auch auf der Summenseite: eine Tagessumme aus Redis, die
    // noch von gestern (ohne diese Felder) stammt, ergaebe sonst NaN.
    t.newsZyklen = zahl(t.newsZyklen) + (s.kontext?.news === true ? 1 : 0);
    t.mtfSumme = zahl(t.mtfSumme) + zahl(s.kontext?.mtfSymbole);
    for (const [k, n] of Object.entries(s.regelbrueche ?? {})) {
      t.regelbrueche[k] = (t.regelbrueche[k] ?? 0) + zahl(n);
    }
  }
  for (const tor of b.tore) {
    const summe = t.tore[tor.gate] ?? { ja: 0, nein: 0, fallback: 0, gruende: {} };
    if (tor.fallback) summe.fallback++;
    if (tor.approve) {
      summe.ja++;
      // IM SELBEN `if` wie der Zaehler (Regel vom 22.09.): sonst koennten
      // `ja` und seine Aufteilung auseinanderlaufen. Dieselbe Form wie im
      // `else`-Zweig darunter, nur fuer die andere Seite — die Richtung
      // haengt am TOR, nicht am Grund (eine Zustimmung hat keinen).
      if (tor.direction) {
        summe.richtungenJa ??= {};
        summe.richtungenJa[tor.direction] = (summe.richtungenJa[tor.direction] ?? 0) + 1;
      }
    } else {
      summe.nein++;
      const k = grundSchluessel(tor.reason);
      if (summe.gruende[k] !== undefined || Object.keys(summe.gruende).length < MAX_GRUENDE_JE_TOR) {
        summe.gruende[k] = (summe.gruende[k] ?? 0) + 1;
        // IM SELBEN `if` wie der Grund (Regel vom 22.09.): sonst koennte
        // die Spanne einen Grund nennen, den die Liste gar nicht zeigt.
        const c = tor.confidence;
        if (typeof c === "number" && Number.isFinite(c)) {
          summe.confSpanne ??= {};
          const alt = summe.confSpanne[k];
          summe.confSpanne[k] = alt
            ? { min: Math.min(alt.min, c), max: Math.max(alt.max, c) }
            : { min: c, max: c };
        }
      } else {
        summe.gruende["(weitere)"] = (summe.gruende["(weitere)"] ?? 0) + 1;
      }
      // Die Richtung haengt am TOR, nicht am Grund — sonst zerfiele sie
      // mit jedem neuen Grundtext. Und nur bei Ablehnungen, wie `gruende`.
      if (tor.direction) {
        summe.richtungen ??= {};
        summe.richtungen[tor.direction] = (summe.richtungen[tor.direction] ?? 0) + 1;
      }
    }
    t.tore[tor.gate] = summe;
  }
  t.trades += b.trades.length;
  t.fehlgeschlagen += b.fehlgeschlagen.length;
  // Broker-Fehler MIT GRUND (20.09.). Die Tagesbilanz vom 18.09. meldete
  // "Broker-Fehler: 2" — und sonst nichts. Die Zyklus-Zeile kennt den Grund
  // ("GBPUSD: MARKET_CLOSED"), die Tagessumme warf ihn weg. Zwei gescheiterte
  // Orders ohne Grund sind keine Meldung, sondern eine Frage.
  t.fehlgeschlagenGruende ??= {};
  for (const f of b.fehlgeschlagen) {
    const k = grundSchluessel(f);
    if (t.fehlgeschlagenGruende[k] !== undefined
      || Object.keys(t.fehlgeschlagenGruende).length < MAX_GRUENDE_JE_TOR) {
      t.fehlgeschlagenGruende[k] = (t.fehlgeschlagenGruende[k] ?? 0) + 1;
    } else {
      t.fehlgeschlagenGruende["(weitere)"] = (t.fehlgeschlagenGruende["(weitere)"] ?? 0) + 1;
    }
  }
  return t;
}

/** Fuer Telegram (parse_mode HTML) — ein `<` im Grund liesse die Nachricht sonst scheitern. */
// EINE Definition, gemeinsam mit `handels-lage.ts` (31.10.). Zwei Kopien
// waeren zwei Stellen, an denen sie auseinanderlaufen koennen — dieselbe
// Begruendung wie bei `herkunftListe()` in /edge.
export { htmlSicher } from "../html-sicher/html-sicher";
import { htmlSicher, entschaerftGekuerzt } from "../html-sicher/html-sicher";

/** Die Tagesbilanz als Telegram-Text. */
export function tagesbilanzText(t: Tagessumme): string {
  const zeilen: string[] = [];
  zeilen.push(`📋 <b>Zyklus-Tagesbilanz ${htmlSicher(t.datum)}</b>`);
  zeilen.push("");
  zeilen.push(`🔁 Zyklen: ${t.zyklen} (mit Analyse: ${t.scans})`);
  // ── DER SELTENSTE AUSGANG IST DER WICHTIGSTE (18.09.) ──────────────────────
  //
  // Hier stand `.slice(0, 6)`. In der ersten echten Tagesbilanz (17.09., 259
  // Zyklen) ergaben die sechs gezeigten Ausgaenge zusammen 258 — EIN Zyklus
  // endete anders und war nicht zu sehen. Genau so verschwindet ein "Absturz:
  // …": er ist selten, steht deshalb hinten, und faellt aus der Liste.
  //
  // Jetzt: acht Zeilen, ein Absturz IMMER (auch wenn er einmal vorkam), und
  // was dann noch fehlt, wird als Zahl benannt statt verschwiegen.
  const alleAusgaenge = Object.entries(t.ausgaenge).sort((a, b) => b[1] - a[1]);
  const istAbsturz = (k: string) => /absturz|fehler|killswitch/i.test(k);
  const gezeigt = alleAusgaenge.slice(0, 8);
  for (const e of alleAusgaenge) {
    if (istAbsturz(e[0]) && !gezeigt.includes(e)) gezeigt.push(e);
  }
  for (const [k, n] of gezeigt) {
    zeilen.push(`   • ${istAbsturz(k) ? "❗ " : ""}${htmlSicher(k)}: ${n}`);
  }
  const rest = alleAusgaenge.filter((e) => !gezeigt.includes(e));
  if (rest.length > 0) {
    const restZyklen = rest.reduce((s, e) => s + zahl(e[1]), 0);
    zeilen.push(`   • (${rest.length} weitere Ausgaenge, ${restZyklen} Zyklen)`);
  }
  if (t.scans > 0) {
    zeilen.push("");
    zeilen.push(`🧠 GPT: ${t.gpt.WAIT} WAIT · ${t.gpt.BUY} BUY · ${t.gpt.SELL} SELL (${t.maerkte} Marktanalysen)`);
    // Ein Ausfall darf sich nicht als Urteil ausgeben (30.10.): von den
    // WAIT sind das die, bei denen GPT gar nicht geantwortet hat.
    zeilen.push(`🤐 davon OHNE GPT-Antwort: ${zahl(t.ohneGptAntwort)} `
      + `(als WAIT gezählt, aber kein Urteil)`);
    // UND WARUM (23.11.): ganzer Zyklus ohne Antwort oder einzelne Maerkte
    // ausgelassen. Nur fuer den GEMESSENEN Teil des Tages — eine Summe von
    // vor dem Deploy kennt die Felder nicht, und dann steht das da.
    if (zahl(t.ohneGptAntwort) > 0) {
      const gepr = zahl(t.gptLageGeprueft);
      // Nach Menge sortiert, wie jede andere Aufschluesselung hier — eine
      // feste Reihenfolge waere eine zweite Liste der Lagen, die veraltet.
      const teileL = Object.entries(t.ohneGptJeLage ?? {})
        .filter(([, v]) => zahl(v) > 0)
        .sort((a, b) => zahl(b[1]) - zahl(a[1]))
        .map(([k, n]) => `${htmlSicher(k)} ${zahl(n)}`);
      zeilen.push(gepr === 0
        ? "   ↳ nicht aufgeschlüsselt (Analysen vor dem 23.11.)"
        : `   ↳ ${teileL.length > 0 ? teileL.join(" · ") : "keine Lage verbucht"} `
          + `(aufgeschlüsselt ${gepr} von ${t.scans} Analysen)`);
      for (const [k, n] of Object.entries(t.gptAusfallGruende ?? {})
        .filter(([, v]) => zahl(v) > 0).sort((a, b) => zahl(b[1]) - zahl(a[1])).slice(0, 3)) {
        // Fremder Text (OpenAIs Antwortkoerper): begrenzt NACH dem Entschaerfen.
        zeilen.push(`   ❗ ${entschaerftGekuerzt(k, GPT_GRUND_MAX_BILANZ)} (${zahl(n)}×)`);
      }
    }
    // 25.11.: die Nachfrage fehlender Maerkte — ob sie hilft. Dreiwertig wie
    // das Claude-Veto: ohne Messung keine Zahl. Steht NACH der Aufschluesselung
    // oben, damit `↳`/`❗` an ihrer Zeile bleiben; „ohne GPT-Antwort" ist der
    // Endstand NACH der Nachfrage.
    const nachGepr = zahl(t.gptNachfrageGeprueft);
    zeilen.push(nachGepr === 0
      ? "🔁 GPT-Nachfrage: nicht gemessen (Analysen vor dem 25.11.)"
      : `🔁 GPT-Nachfrage: ${zahl(t.gptNachfragen)} Zyklen · ${zahl(t.gptNachgefragt)} Maerkte nachgefragt `
        + `· ${zahl(t.gptNachgeholt)} nachgeholt (gemessen in ${nachGepr} von ${t.scans} Analysen)`);
    // Dieselbe Klasse eine Stufe weiter: GPT HAT geantwortet, aber mit
    // einer Zahl, die keine ist (15.11.). Ohne diese Zeile stirbt das
    // Signal sichtbar an `ohne Stop/Ziel` oder `unter der Grenze` — und
    // sieht dort wie ein Urteil aus.
    zeilen.push(`🔢 davon mit UNBRAUCHBARER Zahl: ${zahl(t.gptZahlUnbrauchbar)} `
      + `(Text/Objekt/Infinity — kein Urteil)`);
    zeilen.push(`🚧 Vetos: ${t.vetos} · Stil verworfen: ${t.stilVerworfen}`);
    const spanne = t.confMin !== null ? ` (Confidence ${t.confMin}–${t.confMax})` : "";
    zeilen.push(`📉 Unter der Untergrenze: ${t.unterGrenze}${spanne}`);
    // ── DER AUSFALL GEHOERT IN DEN BERICHT (22.09.) ───────────────────────
    //
    // Ohne diese Zeile meldet ein Abend, an dem das Python-Backend weg war,
    // exakt dasselbe wie ein Abend, an dem die KI nichts mochte: viele
    // Richtungssignale, GO 0. Am 22.09. waren es acht von acht in EINEM
    // Zyklus. Sie steht auch bei 0 da, weil erst der Vergleich mit gestern
    // zeigt, ob ein Dienst wackelt.
    const gruende = Object.entries(t.ohneVolleDatenGrund ?? {})
      .filter(([, n]) => zahl(n) > 0)
      .sort((a, b) => zahl(b[1]) - zahl(a[1]))
      .map(([k, n]) => `${htmlSicher(k)} ${zahl(n)}`)
      .join(", ");
    zeilen.push(`🔒 Ohne vollständige Daten (TA-Lib/Strategien fehlten): ${zahl(t.ohneVolleDaten)}`
      + `${gruende ? ` — ${gruende}` : ""}`);
    zeilen.push(`⚖️ An der Risiko-Freigabe gescheitert (R/R, Risiko-Score oder Claude-Veto): ${t.rrAbgelehnt}`);
    // 24.11.: das Veto `maxRiskPercent: 0` — die Zahl, die zeigt, was es am
    // Handel aendert. Dreiwertig wie die GPT-Lage: ohne Messung keine Zahl.
    const nullGepr = zahl(t.claudeNullGeprueft);
    // Kein `↳`: das Zeichen gehoert der GPT-Aufschluesselung, und deren
    // Pruefer sucht es (eine 0 darf dort nicht aufgeschluesselt werden).
    zeilen.push(nullGepr === 0
      ? "   davon nur am Claude-Veto (Risiko 0): nicht gemessen (Analysen vor dem 24.11.)"
      : `   davon nur am Claude-Veto (Risiko 0): ${zahl(t.claudeNullAllein)} `
        + `(gemessen in ${nullGepr} von ${t.scans} Analysen)`);
    zeilen.push(`✂️ Ohne Stop oder Ziel von GPT (weder GO noch gescheitert): ${zahl(t.ohneStopZiel)}`);
    zeilen.push(`✅ GO: ${t.go} · Claude gefragt: ${t.claudeGefragt}`);
    // 19.11.: die Summenprobe des Trichters — fuer den Teil des Tages, der
    // sie gemacht hat. Ohne Zahl der geprueften Scans behauptete eine Summe
    // von vor dem Deploy „alles zugeordnet".
    if (zahl(t.konsensRichtungen) > 0 || zahl(t.taErsatzRichtungen) > 0) {
      zeilen.push(`🧮 Richtungen ausserhalb von GPT: Konsens ${zahl(t.konsensRichtungen)}`
        + (zahl(t.taErsatzRichtungen) > 0 ? ` · TA-Ersatz ${zahl(t.taErsatzRichtungen)}` : ""));
    }
    const restT = trichterRestText(t);
    zeilen.push(`🧩 Summenprobe (${zahl(t.trichterGeprueft)} von ${t.scans} Analysen): `
      + (zahl(t.trichterGeprueft) === 0 ? "nicht gemessen"
        : restT ? `⚠️ ${restT}` : "jedes Signal genau einer Stufe zugeordnet"));
    // Womit GPT gearbeitet hat. Ein Tag mit "MTF Ø 0" heisst: jedes Urteil kam
    // allein aus dem Tageschart, obwohl der Prompt 1H/1W vorsieht.
    const mtfSchnitt = t.scans > 0 ? Math.round(zahl(t.mtfSumme) / t.scans) : 0;
    zeilen.push(`🧭 Kontext: News in ${zahl(t.newsZyklen)}/${t.scans} Scans · `
      + `Multi-Timeframe Ø ${mtfSchnitt} Symbole`);
    const brueche = Object.entries(t.regelbrueche).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (brueche.length > 0) {
      zeilen.push(`⚠️ GPT gegen eigenen Prompt: ${brueche.map(([k, n]) => `${htmlSicher(k)} ${n}`).join(", ")}`);
    }
  }
  // DIE LISTE BRAUCHT EINEN DECKEL (31.10.). Sie hatte keinen, während die
  // Ausgänge oben einen haben — und gemessen war der Härtefall bei **4087
  // von 4096** Zeichen, also neun Zeichen Luft. `sendTelegram` kennt keine
  // Längengrenze: eine zu lange Tagesbilanz käme GAR NICHT an, immerhin mit
  // Logzeile (25.10.).
  //
  // Nach Ablehnungen sortiert, damit nicht die Reihenfolge des Eintreffens
  // entscheidet, welches Tor wegfällt. Und was fehlt, wird GEZÄHLT statt
  // verschwiegen — dieselbe Regel wie bei den Ausgängen: eine stille
  // Kürzung sieht wie eine vollständige Liste aus.
  const TORE_MAX = 6;
  const alleTore = Object.entries(t.tore).sort((a, b) => b[1].nein - a[1].nein);
  const tore = alleTore.slice(0, TORE_MAX);
  if (tore.length > 0) {
    zeilen.push("");
    zeilen.push("🚪 <b>Tore</b>");
    for (const [gate, s] of tore) {
      const fb = s.fallback > 0 ? ` · ${s.fallback} Rückfall` : "";
      // Seit dem 02.11. meldet nur noch `Zyklus-Limit` ausschliesslich
      // Ablehnungen — es ist kein Kandidaten-Tor. Dort wuerde "0 ja"
      // faelschlich nach "nichts durchgelassen" klingen.
      const ja = s.ja > 0
        ? `${s.ja} ja${htmlSicher(richtungText(s.richtungenJa, true, s.ja))} · ` : "";
      zeilen.push(`   ${htmlSicher(gate)}: ${ja}${s.nein} nein`
        + `${htmlSicher(richtungText(s.richtungen, true, s.nein))}${fb}`);
      const top = Object.entries(s.gruende).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [k, n] of top) {
        zeilen.push(`      – ${htmlSicher(k)} (${n}×)${confText(s.confSpanne?.[k])}`);
      }
    }
    const restTore = alleTore.length - tore.length;
    if (restTore > 0) {
      const restNein = alleTore.slice(TORE_MAX).reduce((sum, [, s]) => sum + s.nein, 0);
      zeilen.push(`   (${restTore} weitere Tore, ${restNein} Ablehnungen)`);
    }
  }
  zeilen.push("");
  zeilen.push(`💼 Trades eröffnet: ${t.trades} · Broker-Fehler: ${t.fehlgeschlagen}`);
  // Und WARUM sie scheiterten — sonst ist die Zahl nur eine Frage (20.09.).
  for (const [k, n] of Object.entries(t.fehlgeschlagenGruende ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    zeilen.push(`   ❗ ${htmlSicher(k)} (${n}×)`);
  }
  if (t.zyklen > 0) {
    zeilen.push(`⏱️ Zyklusdauer Ø ${Math.round(t.dauerSummeMs / t.zyklen / 1000)} s, max ${Math.round(t.dauerMaxMs / 1000)} s`);
  }
  return zeilen.join("\n");
}

// ── Zustand und Bus-Anbindung ────────────────────────────────────────────────
//
// Auf `global` — Schreiber (Orchestrator-Zyklus) und Leser (spaeter evtl.
// eine Route) sehen sonst verschiedene Modulkopien (28.07., 26.08.).

type BilanzZustand = { abonniert: boolean; aktuell: ZyklusBilanz | null };

declare global {
  // eslint-disable-next-line no-var
  var __zyklus_bilanz__: BilanzZustand | undefined;
}

function zustand(): BilanzZustand {
  global.__zyklus_bilanz__ ??= { abonniert: false, aktuell: null };
  return global.__zyklus_bilanz__;
}

export const TAGESSUMME_SCHLUESSEL = (datum: string) => `zyklus:tag:${datum}`;
const TAGESSUMME_TTL = 3 * 24 * 60 * 60;

/**
 * UTC-Datum als Tagesschlüssel.
 *
 * Seit dem 01.11. ist das Fenster an die Börsenzonen gebunden (07:00 London
 * bis 17:00 New York) statt an feste UTC-Stunden. Der UTC-Tag bleibt
 * trotzdem der richtige Schlüssel: gerechnet reicht das Fenster von 06:00
 * bzw. 07:00 UTC bis 21:00 bzw. 22:00 UTC und überschreitet damit **nie**
 * Mitternacht UTC. Ein Handelstag fällt also immer in genau ein UTC-Datum.
 */
export function handelstag(jetzt: Date = new Date()): string {
  return jetzt.toISOString().slice(0, 10);
}

/** Einmal am Bus anmelden. Mehrfacher Aufruf ist harmlos. Wirft nie. */
export async function bilanzAbonnieren(): Promise<void> {
  try {
    const z = zustand();
    if (z.abonniert) return;
    const { agentBus } = await import("../agents/agent-bus");
    if (z.abonniert) return;
    z.abonniert = true;

    agentBus.subscribe("CYCLE:STARTED", () => {
      zustand().aktuell = neueBilanz(Date.now());
    });
    for (const typ of ["ANALYSIS:SCAN_DONE", "GATE:DECISION", "EXECUTION:TRADE_OPENED", "EXECUTION:TRADE_FAILED"] as const) {
      agentBus.subscribe(typ, (ev) => {
        const b = zustand().aktuell;
        if (b) bilanzVerbuchen(b, ev);
      });
    }
    agentBus.subscribe("CYCLE:FINISHED", async (ev) => {
      const zz = zustand();
      const b = zz.aktuell;
      zz.aktuell = null;
      if (!b) return;
      b.ende = Date.now();
      b.ausgang = text(ev.payload?.ausgang ?? "unbekannt");
      console.log(bilanzZeile(b));
      try {
        const { cacheGet, cacheSet } = await import("../cache/redis-cache");
        const tag = handelstag();
        const alt = await cacheGet<Tagessumme>(TAGESSUMME_SCHLUESSEL(tag));
        await cacheSet(TAGESSUMME_SCHLUESSEL(tag), tagessummeAddieren(alt, b, tag), TAGESSUMME_TTL);
      } catch (e) {
        console.warn(`[zyklus] Tagessumme nicht gespeichert: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Schattenbuch (25.11.): die Signale dieses Zyklus mit ihrem Schicksal.
      // Eigener `try` — ein Fehler hier darf die Tagessumme nicht beruehren,
      // und `schattenTagVerbuchen` wirft ohnehin nicht.
      try {
        const { schattenTagVerbuchen } = await import("../schattenbuch/schattenbuch-speicher");
        // Der Tag des Zyklusbeginns — dort liegt auch der Zeitstempel der Eintraege.
        await schattenTagVerbuchen(b, handelstag(new Date(b.start)));
      } catch (e) {
        console.warn(`[zyklus] Schattenbuch nicht verbucht: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  } catch (e) {
    console.warn(`[zyklus] Bilanz nicht am Bus angemeldet: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Die Tagessumme lesen und als Telegram-Nachricht senden. Wirft nie. */
export async function tagesbilanzSenden(tag: string = handelstag()): Promise<boolean> {
  try {
    const { cacheGet } = await import("../cache/redis-cache");
    const t = (await cacheGet<Tagessumme>(TAGESSUMME_SCHLUESSEL(tag))) ?? leereTagessumme(tag);
    const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
    const nachricht = t.zyklen === 0
      ? `${tagesbilanzText(t)}\n\n⚠️ Heute wurde KEIN Handelszyklus verbucht — lief der Orchestrator?`
      : tagesbilanzText(t);
    return await sendTelegram(nachricht);
  } catch {
    return false;
  }
}
