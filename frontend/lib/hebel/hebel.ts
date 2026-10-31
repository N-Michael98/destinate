/**
 * WELCHE EINSTELLUNG WÜRDE WAS BRINGEN? — `/hebel` (29.10.)
 *
 * ── WOZU ────────────────────────────────────────────────────────────────────
 *
 * `/edge` sagt, DASS kein Edge da ist (EW −2.39 je Trade, R/R 0.43 statt
 * nötiger 1.20). `/status` sagt seit heute, WO die Signale sterben. Offen
 * bleibt die Frage davor: **welche Schraube würde etwas ändern?**
 *
 * Diese Datei beantwortet sie **ausschliesslich aus den echten Trades** —
 * gruppiert nach den Grössen, an denen man wirklich drehen kann, und je
 * Gruppe mit demselben Erwartungswert, den `/edge` ausweist.
 *
 * ── SIE RECHNET NICHT SELBST ────────────────────────────────────────────────
 *
 * Jede Gruppe geht durch `erwartungswert()` — dieselbe Funktion, dieselben
 * Ausschlüsse (`KEIN_PNL`/`NIE_BESTAETIGT`, unlesbare Notizen, Fenster, Zeilen
 * ohne Datum). Eine zweite Formel wäre eine zweite Wahrheit: `/edge` und
 * `/hebel` könnten sich dann widersprechen, und man wüsste nicht, welcher
 * recht hat. Genau diesen Widerspruch hat der erste `/edge`-Lauf am 26.10.
 * gezeigt — um den Faktor 5.32.
 *
 * ── WAS SIE NICHT KANN, UND DAS STEHT IM BERICHT ────────────────────────────
 *
 * Die `Trade`-Tabelle hat **keine Confidence-Spalte** (nachgesehen im Schema,
 * nicht vermutet). Eine Empfehlung zur Freigabe-Schwelle ist aus den echten
 * Trades damit **nicht** berechenbar — und wird deshalb nicht gegeben,
 * sondern benannt. Eine erfundene Empfehlung wäre schlimmer als keine.
 *
 * ── UND EIN UNTERSCHIED IST KEINE ZUSAGE ────────────────────────────────────
 *
 * Der Bericht sagt „Gruppe A hat EW x, Gruppe B hat EW y". Er sagt NICHT
 * „stell die Schwelle auf A". Wer eine Schwelle verschiebt, ändert auch die
 * MENGE der Trades — die übrigbleibenden sind dann nicht mehr dieselben. Das
 * steht so im Text, damit aus einer Messung keine Versprechung wird.
 *
 * Reine Rechnung: keine Order, kein Stop, keine Einstellung.
 */

import {
  erwartungswert, MIN_TRADES,
  type TradeZeile, type EwFenster,
} from "../expectancy/erwartungswert";

/** Eine Zeile mit den Feldern, an denen sich drehen lässt. */
export type HebelZeile = TradeZeile & {
  /** Geplantes R/R beim Einstieg (`Trade.riskReward`, Standard 0). */
  riskReward?: number | null;
  market?: string | null;
  direction?: string | null;
  strategy?: string | null;
};

export type HebelGruppe = {
  name: string;
  /** Ø P&L je gewertetem Trade — aus `erwartungswert()`. */
  ew: number | null;
  gewertet: number;
  /** Trefferquote unter den ENTSCHIEDENEN (derselbe Nenner wie bei /edge). */
  trefferquote: number | null;
  /** Ø Gewinn / Ø Verlust. */
  rr: number | null;
  /** Ab `MIN_TRADES` — darunter wird KEIN Erwartungswert ausgegeben. */
  belastbar: boolean;
};

export type HebelDimension = {
  titel: string;
  /** Was an dieser Stelle nicht messbar ist. `null` = nichts zu melden. */
  hinweis: string | null;
  gruppen: HebelGruppe[];
  /** Der Befund — leer, wenn zu wenig belastbare Gruppen da sind. */
  befund: string;
};

/** Endliche Zahl oder `null`. */
function zahl(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Text oder `null`; leer bleibt leer statt „UNDEFINED" zu werden. */
function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Das geplante R/R in Bänder — die Schwelle beim Einstieg ist **1.5**
 * (`ai-analysis-engine.ts:911`), deshalb liegt dort eine Bandgrenze.
 *
 * `riskReward` hat im Schema den Standard **0**. Eine 0 heisst also „nie
 * geschrieben", nicht „R/R null" — sie kommt in ein eigenes Band und wird
 * NICHT als 0 mitgerechnet. Dieselbe Regel wie bei `profitLoss` am 26.10.
 */
export function rrBand(v: number | null): string {
  // `Number.isFinite` steht hier mit Absicht — und es stand zuerst NICHT da.
  // Der eigene Prüfstand hat es gefangen: `NaN <= 0` ist **false**, und jeder
  // weitere `<`-Vergleich ebenfalls, also fiel ein `NaN` bis ins BESTE Band
  // `≥ 3.0` durch. Dieselbe Falle wie bei `checkPriceAvailable` (24.08.) und
  // `ordersRiegel` (28.10.).
  //
  // Der heutige Aufrufer reicht nie ein `NaN` herein (`zahl()` macht daraus
  // `null`) — die Funktion ist exportiert und muss trotzdem für sich stimmen.
  if (v === null || !Number.isFinite(v) || v <= 0) return "ohne Angabe";
  if (v < 1.5) return "< 1.5 (unter der Einstiegs-Schwelle)";
  if (v < 2) return "1.5 – 1.99";
  if (v < 3) return "2.0 – 2.99";
  return "≥ 3.0";
}

/** Reihenfolge der R/R-Bänder — sortiert nach Grösse, nicht nach Häufigkeit. */
const RR_ORDNUNG = ["< 1.5 (unter der Einstiegs-Schwelle)", "1.5 – 1.99",
  "2.0 – 2.99", "≥ 3.0", "ohne Angabe"];

/** Liest ein Etikett aus den Notizen, ohne auf unlesbares JSON zu stürzen. */
function ausNotizen(roh: string | null, feld: string): string | null {
  if (!roh) return null;
  try {
    const m = JSON.parse(roh) as unknown;
    if (!m || typeof m !== "object" || Array.isArray(m)) return null;
    return text((m as Record<string, unknown>)[feld]);
  } catch { return null; }
}

/**
 * Gruppiert die Zeilen nach einer Dimension und rechnet JEDE Gruppe durch
 * `erwartungswert()`.
 *
 * Gruppiert wird auf den ROHEN Zeilen — die Ausschlüsse macht
 * `erwartungswert()` danach in jeder Gruppe gleich. Vorher zu filtern hiesse,
 * zwei Ausschluss-Regeln zu pflegen.
 */
function gruppiere(
  zeilen: ReadonlyArray<HebelZeile>,
  schluessel: (z: HebelZeile) => string,
  fenster?: EwFenster | null,
  ordnung?: string[],
): HebelGruppe[] {
  const topf = new Map<string, HebelZeile[]>();
  for (const z of zeilen) {
    const k = schluessel(z);
    const liste = topf.get(k);
    if (liste) liste.push(z); else topf.set(k, [z]);
  }
  const gruppen: HebelGruppe[] = [];
  for (const [name, liste] of topf) {
    const e = erwartungswert(liste, fenster ?? null);
    gruppen.push({
      name,
      ew: e.gewertet >= MIN_TRADES ? e.erwartungswert : null,
      gewertet: e.gewertet,
      trefferquote: e.gewertet >= MIN_TRADES ? e.trefferquoteEntschieden : null,
      rr: e.gewertet >= MIN_TRADES ? e.rr : null,
      belastbar: e.gewertet >= MIN_TRADES,
    });
  }
  if (ordnung) {
    gruppen.sort((a, b) => {
      const ia = ordnung.indexOf(a.name); const ib = ordnung.indexOf(b.name);
      return (ia < 0 ? ordnung.length : ia) - (ib < 0 ? ordnung.length : ib);
    });
  } else {
    gruppen.sort((a, b) => b.gewertet - a.gewertet);
  }
  return gruppen;
}

/**
 * Der Befund einer Dimension.
 *
 * NUR aus Gruppen, die BEIDE belastbar sind. Ein Vergleich „EW +5 (n=4)
 * gegen EW −3 (n=200)" ist keine Erkenntnis, sondern Rauschen — und genau so
 * entstehen die Empfehlungen, die Geld kosten.
 */
export function befundVon(gruppen: ReadonlyArray<HebelGruppe>): string {
  const belastbar = gruppen.filter((g) => g.belastbar && g.ew !== null);
  if (belastbar.length === 0) {
    return `keine Gruppe erreicht ${MIN_TRADES} gewertete Trades — kein Befund`;
  }
  if (belastbar.length === 1) {
    const g = belastbar[0];
    return `nur eine belastbare Gruppe (${g.name}, ${g.gewertet} Trades) — `
      + "ohne Vergleichsgruppe kein Befund";
  }
  const sortiert = [...belastbar].sort((a, b) => (b.ew as number) - (a.ew as number));
  const best = sortiert[0];
  const schlecht = sortiert[sortiert.length - 1];
  const diff = (best.ew as number) - (schlecht.ew as number);
  return `beste Gruppe „${best.name}" EW ${(best.ew as number).toFixed(2)} `
    + `(${best.gewertet} Trades) · schlechteste „${schlecht.name}" EW `
    + `${(schlecht.ew as number).toFixed(2)} (${schlecht.gewertet}) · `
    + `Unterschied ${diff.toFixed(2)} je Trade`;
}

export function hebelBericht(
  zeilen: ReadonlyArray<HebelZeile>,
  fenster?: EwFenster | null,
): HebelDimension[] {
  const dims: HebelDimension[] = [];

  // DIE FRAGE, FUER DIE ES /hebel GIBT (30.10.): taugt der gemessene
  // Konsens etwas? Steht erst seit heute im Trade — aeltere Zeilen
  // tragen die Angabe nicht und erscheinen als „ohne Angabe".
  dims.push({
    titel: "Signalherkunft",
    hinweis: "Wird erst seit dem 30.10. mitgeschrieben — ältere Trades "
      + "stehen unter „ohne Angabe“. `MEASURED_CONSENSUS` heisst: GPT "
      + "sagte WAIT, und TA-Lib, Strategien und Entry-Quality waren sich "
      + "einig.",
    gruppen: gruppiere(zeilen,
      (z) => ausNotizen(z.notes ?? null, "signalQuelle") ?? "ohne Angabe", fenster),
    befund: "",
  });

  dims.push({
    titel: "Geplantes R/R beim Einstieg",
    hinweis: "Die Einstiegs-Schwelle liegt bei 1.5. `riskReward` hat im "
      + "Schema den Standard 0 — eine 0 heisst „nie geschrieben“ und wird "
      + "nicht als R/R 0 mitgerechnet.",
    gruppen: gruppiere(zeilen, (z) => rrBand(zahl(z.riskReward)), fenster, RR_ORDNUNG),
    befund: "",
  });

  dims.push({
    titel: "Handelsstil",
    // DER SCHLUESSEL HEISST `tradingStyle`, NICHT `stil`.
    //
    // Hier stand bis zum 30.10. `"stil"` — ein Name aus dem Gedaechtnis.
    // Die Journal-Notizen schreiben `tradingStyle`
    // (`capital-trade-tracker.ts`), und der autoritative Leser
    // `stammdatenAusNotizen` (`risk-agent.ts`) liest denselben Namen.
    // Die Dimension war damit DAUERHAFT „ohne Angabe" — und sah dabei
    // wie ein ehrliches Ergebnis aus. Fehlerklasse vom 30.09.
    hinweis: null,
    gruppen: gruppiere(zeilen,
      (z) => ausNotizen(z.notes ?? null, "tradingStyle") ?? "ohne Angabe", fenster),
    befund: "",
  });

  dims.push({
    titel: "Richtung",
    hinweis: null,
    gruppen: gruppiere(zeilen, (z) => text(z.direction) ?? "ohne Angabe", fenster),
    befund: "",
  });

  dims.push({
    titel: "Markt",
    hinweis: null,
    gruppen: gruppiere(zeilen, (z) => text(z.market) ?? "ohne Angabe", fenster),
    befund: "",
  });

  dims.push({
    // EHRLICHER TITEL: die Spalte `Trade.strategy` bekommt
    // `"<tradingStyle> | <strategy>"` (`capital-trade-tracker.ts`), und der
    // Orchestrator setzt `strategy: candidate.gpt.tradingStyle` — bei
    // Auto-Trades steht dort also ZWEIMAL der Stil. „Strategie" allein
    // waere eine Behauptung ueber einen Inhalt, den das Feld nicht hat.
    titel: "Strategie-Feld (Stil | Strategie)",
    hinweis: "Bei Auto-Trades tragen beide Teile den Handelsstil — die "
      + "Spalte unterscheidet die Signalherkunft NICHT.",
    gruppen: gruppiere(zeilen, (z) => text(z.strategy) ?? "ohne Angabe", fenster),
    befund: "",
  });

  for (const d of dims) d.befund = befundVon(d.gruppen);
  return dims;
}

/** Wie viele Gruppen je Dimension gezeigt werden — der Rest wird GEZÄHLT. */
export const GRUPPEN_MAX = 6;

/**
 * Obergrenze der Antwort in Zeichen (31.10.).
 *
 * Telegram nimmt 4096 und lehnt laengere Nachrichten mit HTTP 200 und
 * `{ok:false}` ab — der Befehl verpufft dann. GEMESSEN: drei Gruppen je
 * Dimension ergeben 3002 Zeichen, SECHS (bei 30 Maerkten der Normalfall)
 * bereits 3831, ein Haertefall mit langen Namen 4973.
 *
 * 3900 statt 4096: Luft fuer HTML-Entities, die Telegram laenger zaehlt
 * als das Zeichen im Quelltext.
 */
export const MAX_ZEICHEN = 3900;

/**
 * Baut den Text mit hoechstens `maxGruppen` Gruppen je Dimension.
 *
 * Als eigene Funktion, damit `hebelText()` sie mit kleiner werdendem
 * `maxGruppen` erneut aufrufen kann, bis die Antwort unter die
 * Telegram-Grenze passt — und damit ein Pruefer sie AUSFUEHREN kann.
 */
function textMit(
  dims: ReadonlyArray<HebelDimension>,
  fensterTage: number | null,
  maxGruppen: number,
): string {
  const z: string[] = [];
  z.push("🔧 <b>Hebel — was würde etwas ändern?</b>");
  z.push("");
  z.push(fensterTage === null
    ? "Zeitraum: <b>alles</b>  (/hebel 60 = letzte 60 Tage)"
    : `Zeitraum: letzte <b>${fensterTage}</b> Tage  (/hebel = alles)`);
  z.push(`Gerechnet wird je Gruppe mit derselben Funktion wie bei /edge. `
    + `Unter ${MIN_TRADES} gewerteten Trades wird <b>kein</b> Erwartungswert `
    + `ausgegeben.`);

  for (const d of dims) {
    z.push("");
    z.push(`<b>${d.titel}</b>`);
    if (d.hinweis) z.push(`<i>${d.hinweis}</i>`);
    const gezeigt = d.gruppen.slice(0, maxGruppen);
    for (const g of gezeigt) {
      if (!g.belastbar) {
        z.push(`   • ${g.name}: ${g.gewertet} Trades — zu wenig für einen `
          + `Erwartungswert`);
        continue;
      }
      const tq = g.trefferquote === null ? "—" : `${g.trefferquote.toFixed(0)} %`;
      const rr = g.rr === null ? "—" : g.rr.toFixed(2);
      z.push(`   • ${g.name}: EW <b>${(g.ew as number).toFixed(2)}</b> · `
        + `${g.gewertet} Trades · Treffer ${tq} · R/R ${rr}`);
    }
    const rest = d.gruppen.length - gezeigt.length;
    if (rest > 0) {
      const restTrades = d.gruppen.slice(maxGruppen)
        .reduce((s, g) => s + g.gewertet, 0);
      z.push(`   • (${rest} weitere Gruppen, ${restTrades} Trades)`);
    }
    z.push(`   → ${d.befund}`);
  }

  z.push("");
  z.push("⚠️ <b>Ein Unterschied ist keine Zusage.</b> Wer eine Schwelle "
    + "verschiebt, ändert auch die MENGE der Trades — die übrigbleibenden "
    + "sind dann nicht mehr dieselben wie die hier gemessenen.");
  z.push("");
  z.push("🚫 <b>Nicht berechenbar:</b> die Confidence-Schwelle. Die "
    + "<code>Trade</code>-Tabelle hat keine Confidence-Spalte — eine "
    + "Empfehlung dazu wäre erfunden.");
  if (maxGruppen < GRUPPEN_MAX) {
    z.push("");
    z.push(`ℹ️ Wegen der Telegram-Grenze werden je Dimension nur `
      + `${maxGruppen} statt ${GRUPPEN_MAX} Gruppen gezeigt — was fehlt, `
      + `steht als „weitere Gruppen“ in der jeweiligen Zeile.`);
  }
  return z.join("\n");
}

/**
 * Die Antwort — garantiert unter `MAX_ZEICHEN`.
 *
 * KEINE Stueckelung und kein stilles Abschneiden: es werden weniger
 * Gruppen je Dimension gezeigt, bis es passt, und was fehlt, steht
 * weiterhin als „(N weitere Gruppen, M Trades)" in der Zeile. Der GRUND
 * der Kuerzung wird benannt.
 *
 * Passt selbst EINE Gruppe je Dimension nicht, wird hart gekuerzt — mit
 * einer Zeile, die das sagt. Eine stumm abgeschnittene Antwort waere
 * schlimmer als eine kurze.
 */
export function hebelText(
  dims: ReadonlyArray<HebelDimension>,
  fensterTage: number | null,
): string {
  for (let max = GRUPPEN_MAX; max >= 1; max--) {
    const t = textMit(dims, fensterTage, max);
    if (t.length <= MAX_ZEICHEN) return t;
  }
  const hinweis = "\n\n✂️ Gekürzt: selbst mit einer Gruppe je Dimension "
    + "passt die Antwort nicht in eine Telegram-Nachricht.";
  return textMit(dims, fensterTage, 1).slice(0, MAX_ZEICHEN - hinweis.length)
    + hinweis;
}
