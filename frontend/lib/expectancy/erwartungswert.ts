/**
 * Der Erwartungswert — die Zahl, die sagt, ob das System einen Edge hat
 * (26.10.)
 *
 * ── DER ANLASS ──────────────────────────────────────────────────────────────
 *
 * „Viele grüne Trades, und das Konto sinkt trotzdem." Das ist kein Rätsel,
 * sondern eine Rechnung: der Erwartungswert ist der **durchschnittliche P&L
 * je Trade**. Nichts anderes.
 *
 * Diese Zahl wurde im ganzen Programm **nirgends** gerechnet (gesucht in
 * `frontend/lib`, kein Treffer).
 *
 * ── DER FEHLER IN DER ERSTEN FASSUNG, GEFANGEN AM LIVE-LAUF (26.10.) ───────
 *
 * Die erste Fassung rechnete:
 *
 *   EW = Trefferquote × Ø Gewinn − **(1 − Trefferquote)** × Ø Verlust
 *
 * Das ist nur richtig, wenn es **keine Breakeven-Trades gibt**. `1 −
 * Trefferquote` sind sonst *Verlierer **und** Breakeven zusammen* — und jeder
 * Breakeven bekommt damit einen vollen Ø Verlust aufgebürdet, obwohl er
 * nichts verloren hat.
 *
 * Der erste echte Lauf hat es sofort gezeigt. In **einer** Antwort standen:
 *
 *   Summe P&L: −1822.39    ·    Erwartungswert: −11.9    ·    gewertet: 814
 *
 * −11.9 × 814 = **−9686.60**. Die Antwort widersprach sich selbst um den
 * Faktor 5.3, weil 517 der 814 Zeilen Breakeven waren.
 *
 * **Warum kein Prüfer das sah:** von den fünf gerechneten Testfällen hatte
 * **keiner** einen Breakeven-Trade (21W/9L, 12W/18L, 20W/10L …). Genau dann
 * ist `1 − Trefferquote` zufällig gleich der echten Verlustquote, und die
 * falsche Formel liefert das richtige Ergebnis. „Ein Prüfer, der den Fehler
 * nicht kennt, beweist nichts über ihn" — dieselbe Lehre wie am 30.09. bei
 * `lifecycle-rueckkehr`.
 *
 * **Jetzt** wird der Erwartungswert als das gerechnet, was er ist: Summe
 * durch Anzahl. Damit **kann** er der ausgewiesenen Summe nicht mehr
 * widersprechen — und die Antwort führt die Summenprobe selbst mit.
 *
 * ── WARUM DIE DATENQUALITÄT MIT INS ERGEBNIS GEHÖRT ────────────────────────
 *
 * Am 30.09. kam heraus, dass ein Trade ZWEI Journal-Zeilen erzeugte: die
 * echte starb als `KEIN_PNL` mit P&L 0, die rekonstruierte trug das echte
 * Ergebnis. Die Etiketten fliegen deshalb raus.
 *
 * Das reicht aber nicht. `profitLoss` ist im Schema `Float @default(0)` —
 * eine Zeile, deren P&L **nie geschrieben wurde**, steht auf exakt 0 und
 * sieht damit aus wie ein sauberer Breakeven. Beispiel im Code:
 * `icmarkets-trade-manager.ts` setzt beim Zeit-Exit `status` und `result`,
 * aber **kein** `profitLoss`.
 *
 * Ein solcher Phantom-Breakeven ist von einem echten **an der Zahl allein
 * nicht zu unterscheiden**. Deshalb weist diese Funktion die Breakeven-Zeilen
 * **nach Etikett aufgeschlüsselt** aus (`result`/`exitReason`) und nennt
 * zusätzlich den Erwartungswert **ohne** sie. Wer beide Zahlen sieht, weiss,
 * wie viel an der Frage hängt; wer nur eine sieht, rät.
 *
 * ── UND EIN AUSFALL GIBT SICH NICHT ALS ERGEBNIS AUS ────────────────────────
 *
 * Unter `MIN_TRADES` wird **kein** Erwartungswert ausgegeben, sondern
 * `belastbar: false` mit Grund. Die Projektregel seit dem 07.09.: ein
 * Rückfallwert an einer Stelle, die über Geld entscheidet, macht aus
 * „unbekannt" eine Messung.
 */

import { ETIKETTEN_OHNE_ERGEBNIS } from "../capital-com/capital-trade-tracker";

/** Ab hier ist die Rechnung belastbar genug für eine Entscheidung. */
export const MIN_TRADES = 30;

/** Was ein Gewinn/Verlust ist — Spread-Verluste sind echte Verluste (09.08.). */
export const BREAKEVEN_GRENZE = 0.01;

/**
 * Ab diesem Anteil Breakeven wird die Herkunft laut gemeldet. 20 % ist kein
 * Naturgesetz, sondern die Grenze, ab der die Frage „echt oder nie
 * geschrieben?" das Ergebnis spürbar verschiebt.
 */
export const BE_ANTEIL_WARNUNG = 20;

/** So viele Breakeven-Etiketten werden einzeln genannt, der Rest gebündelt. */
export const HERKUNFT_MAX = 6;

export type TradeZeile = {
  profitLoss: number | null;
  notes: string | null;
  /**
   * Die `result`-Spalte. Optional, weil nicht jeder Aufrufer sie mitliest —
   * fehlt sie, steht in der Herkunft „—" statt einer erfundenen Angabe.
   */
  result?: string | null;
  /**
   * Wann die Zeile zuletzt geschrieben wurde. Optional, gleiche Regel: fehlt
   * sie, steht dort `null` und nicht ein erfundenes Datum.
   */
  updatedAt?: Date | string | number | null;
};

export type EwHerkunft = {
  etikett: string;
  anzahl: number;
  /**
   * Ø P&L dieses Etiketts. Die entscheidende Spalte bei den GEWINNERN: ein
   * Ausstieg, der im Schnitt einen Bruchteil dessen bringt, was das Ziel
   * gebracht hätte, erklärt ein realisiertes R/R unter dem geplanten.
   */
  schnitt: number | null;
  /** Aelteste und neueste Zeile dieses Etiketts (`YYYY-MM-DD`), falls bekannt. */
  von: string | null;
  bis: string | null;
};

/**
 * Ein Zeitfenster, auf das die Rechnung begrenzt wird.
 *
 * WOZU. Der Lauf vom 26.10. zerfiel sichtbar in ZWEI Systeme: bis Mitte
 * August Zeilen ohne Ausstiegsgrund mit Ø Gewinn 21.43 und R/R 1.11, danach
 * welche mit Grund und Ø Gewinn 3.13 bei R/R 0.43. Beide in einer Zahl
 * ergeben ein R/R von 0.75, das **keines von beiden** beschreibt — und daraus
 * abgeleitete Hebel zeigen in die falsche Richtung: über alles gerechnet
 * fehlen 23 Punkte Trefferquote, im aktuellen Regime liegt sie längst bei
 * 45 % und es fehlt ausschliesslich am R/R.
 *
 * Das ist die Fehlerklasse „eine Stufe ohne eigene Zahl verschwindet aus der
 * Bilanz", eine Ebene höher: **zwei Regime in einer Zahl**.
 *
 * `jetzt` ist injizierbar, damit ein Prüfer das Fenster rechnen kann, ohne
 * vom Kalender abzuhängen.
 */
export type EwFenster = { tage: number; jetzt?: Date };

export type EwErgebnis = {
  /** Alle geschlossenen Zeilen, die aus der Datenbank kamen. */
  gesamt: number;
  /** Das angewandte Fenster in Tagen, `null` = alles gerechnet. */
  fensterTage: number | null;
  /** Zeilen, die vor dem Fenster liegen — gezählt, nicht still verworfen. */
  ausserhalbFenster: number;
  /**
   * Zeilen, die sich ohne Datum **nicht einordnen** lassen. Sie werden bei
   * gesetztem Fenster ausgeschlossen und hier ausgewiesen — stillschweigend
   * mitzurechnen wäre dieselbe Lüge wie ein erfundenes Datum.
   */
  ohneDatumImFenster: number;
  /** Zeilen mit `NIE_BESTAETIGT` / `KEIN_PNL` — kein Ergebnis, nur ein Etikett. */
  ohneErgebnis: number;
  /** Zeilen, die aus einer Broker-Position rekonstruiert wurden (GEWERTETE). */
  rekonstruiert: number;
  /** Zeilen ohne lesbare Notizen — gezählt, nicht still verworfen. */
  unlesbar: number;
  /** Was nach dem Bereinigen übrig bleibt und gerechnet wird. */
  gewertet: number;

  wins: number;
  losses: number;
  breakeven: number;
  /** Gewinner + Verlierer — die Trades mit einem echten Ergebnis. */
  entschieden: number;

  /** Prozent der GEWERTETEN. `null` wenn nichts zu rechnen war. */
  trefferquote: number | null;
  /** `losses / gewertet` — die ECHTE Verlustquote, nicht `1 − Treffer`. */
  verlustquote: number | null;
  /** Prozent der ENTSCHIEDENEN — derselbe Nenner wie `breakevenQuote`. */
  trefferquoteEntschieden: number | null;
  /** Anteil Breakeven an den gewerteten, in Prozent. */
  breakevenAnteil: number | null;

  avgGewinn: number | null;
  avgVerlust: number | null;
  /** Ø Gewinn / Ø Verlust. `null` wenn es keine Verluste gab. */
  rr: number | null;
  /**
   * Ab welcher Trefferquote **unter den entschiedenen** Trades das System bei
   * diesem R/R die Null hält. Breakeven-Trades sind dabei neutral.
   */
  breakevenQuote: number | null;

  /** Die Zahl, um die es geht: Ø P&L je gewertetem Trade. */
  erwartungswert: number | null;
  /** Derselbe Wert ohne die Breakeven — `null`, wenn es keine gibt. */
  erwartungswertEntschieden: number | null;
  /** Summe aller gewerteten P&L — zum Abgleich mit dem Konto. */
  summePnl: number;
  /** Woher die Breakeven-Zeilen kommen: `result/exitReason` → Anzahl. */
  breakevenHerkunft: EwHerkunft[];
  /**
   * Woran die GEWINNER enden. Der Einstieg verlangt R/R ≥ 1.5
   * (`ai-analysis-engine.ts:911`) — endet der Grossteil der Gewinner an einem
   * Teilgewinn, einem Breakeven-Stop oder einem Trailing statt am Ziel, ist
   * das die Erklärung für ein realisiertes R/R unter dem geplanten.
   */
  gewinnHerkunft: EwHerkunft[];
  /** Dasselbe für die Verlierer — der Gegenpol, sonst fehlt der Vergleich. */
  verlustHerkunft: EwHerkunft[];
  /**
   * Neueste ENTSCHIEDENE Zeile (`YYYY-MM-DD`). Der Vergleichsmassstab: läuft
   * ein Breakeven-Etikett bis an dieses Datum heran, wird es **heute noch**
   * erzeugt; endet es Wochen davor, ist es Altbestand.
   */
  zuletztEntschieden: string | null;

  belastbar: boolean;
  grund: string;
};

/** Liest ein Etikett aus den Notizen, ohne auf unlesbares JSON zu stürzen. */
function notizen(roh: string | null): Record<string, unknown> | null {
  if (!roh) return null;
  try {
    const m = JSON.parse(roh) as unknown;
    return m && typeof m === "object" && !Array.isArray(m)
      ? (m as Record<string, unknown>) : null;
  } catch { return null; }
}

/** Normalisiert ein Etikett; leer bleibt leer statt zu „UNDEFINED" zu werden. */
function etikett(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

/**
 * `YYYY-MM-DD` aus einem Zeitstempel — oder `null`.
 *
 * Ein unlesbares Datum wird **nicht** zu „heute". Das ist dieselbe Regel wie
 * beim Kurs-Alter am 22.09.: eine stille Ersatzzahl macht aus „unbekannt" eine
 * Messung, und hier hinge daran die Frage, ob ein Fehler noch aktiv ist.
 */
export function tag(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v as string | number);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Eine Zeile, nachdem sie den Ausschluss passiert hat. */
export type GewerteteZeile = { pnl: number; herkunft: string; datum: string | null };

/**
 * Gruppiert gewertete Zeilen nach ihrem Etikett (`result/exitReason`) und
 * liefert je Etikett: Anzahl, Ø P&L und die Zeitspanne.
 *
 * ALS EIGENE, EXPORTIERTE FUNKTION, damit ein Prüfer sie **ausführen** kann —
 * und damit Breakeven, Gewinner und Verlierer nachweislich **denselben** Weg
 * gehen. Drei Kopien derselben Gruppierung wären drei Stellen, an denen sie
 * auseinanderlaufen kann.
 *
 * Die Zeitspanne beantwortet die Frage, wegen der es die Aufschlüsselung
 * gibt: *wird dieses Etikett heute noch erzeugt?* Ein fehlendes Datum lässt
 * die Spanne unberührt — es wird **nicht** zu „heute" (Regel vom 22.09.).
 *
 * Mehr als `HERKUNFT_MAX` Etiketten werden gebündelt, nicht verschwiegen.
 */
export function herkunftListe(zeilen: ReadonlyArray<GewerteteZeile>): EwHerkunft[] {
  type Lage = { anzahl: number; summe: number; von: string | null; bis: string | null };
  const leer: Lage = { anzahl: 0, summe: 0, von: null, bis: null };
  const aelter = (a: string | null, b: string | null) =>
    b === null ? a : (a === null || b < a ? b : a);
  const juenger = (a: string | null, b: string | null) =>
    b === null ? a : (a === null || b > a ? b : a);

  const zaehler = new Map<string, Lage>();
  for (const g of zeilen) {
    const l = zaehler.get(g.herkunft) ?? leer;
    zaehler.set(g.herkunft, {
      anzahl: l.anzahl + 1,
      summe: l.summe + g.pnl,
      von: aelter(l.von, g.datum),
      bis: juenger(l.bis, g.datum),
    });
  }
  const sortiert = [...zaehler.entries()]
    .sort((a, b) => b[1].anzahl - a[1].anzahl || a[0].localeCompare(b[0]));
  const bau = (etikett: string, l: Lage): EwHerkunft => ({
    etikett, anzahl: l.anzahl,
    schnitt: l.anzahl > 0 ? Number((l.summe / l.anzahl).toFixed(2)) : null,
    von: l.von, bis: l.bis,
  });

  const aus = sortiert.slice(0, HERKUNFT_MAX).map(([e, l]) => bau(e, l));
  const rest = sortiert.slice(HERKUNFT_MAX);
  if (rest.length > 0) {
    aus.push(bau(`weitere (${rest.length} Etiketten)`, rest.reduce<Lage>((a, [, l]) => ({
      anzahl: a.anzahl + l.anzahl,
      summe: a.summe + l.summe,
      von: aelter(a.von, l.von),
      bis: juenger(a.bis, l.bis),
    }), leer)));
  }
  return aus;
}

export function erwartungswert(
  zeilen: ReadonlyArray<TradeZeile> | null | undefined,
  fenster?: EwFenster | null,
): EwErgebnis {
  const alle = Array.isArray(zeilen) ? zeilen : [];
  // Ein unbrauchbares Fenster (0, negativ, NaN) fällt auf „alles" zurück —
  // und `fensterTage: null` **sagt das auch**, die Antwort behauptet dann
  // kein Fenster. Still ein Fenster vortäuschen wäre der Fehler; ehrlich
  // zurückfallen ist keiner. Die Route weist eine solche Eingabe ohnehin
  // vorher mit einer Meldung ab, statt sie hier ankommen zu lassen.
  const tage = fenster && Number.isFinite(fenster.tage) && fenster.tage > 0
    ? Math.floor(fenster.tage) : null;
  const grenze = tage === null ? null
    : tag(new Date((fenster?.jetzt ?? new Date()).getTime() - tage * 86400000));
  const leer: EwErgebnis = {
    gesamt: alle.length, fensterTage: tage, ausserhalbFenster: 0, ohneDatumImFenster: 0,
    ohneErgebnis: 0, rekonstruiert: 0, unlesbar: 0, gewertet: 0,
    wins: 0, losses: 0, breakeven: 0, entschieden: 0,
    trefferquote: null, verlustquote: null, trefferquoteEntschieden: null,
    breakevenAnteil: null,
    avgGewinn: null, avgVerlust: null, rr: null, breakevenQuote: null,
    erwartungswert: null, erwartungswertEntschieden: null, summePnl: 0,
    breakevenHerkunft: [], gewinnHerkunft: [], verlustHerkunft: [],
    zuletztEntschieden: null,
    belastbar: false, grund: "",
  };

  let ohneErgebnis = 0, rekonstruiert = 0, unlesbar = 0;
  let ausserhalbFenster = 0, ohneDatumImFenster = 0;
  const gewertet: Array<{ pnl: number; herkunft: string; datum: string | null }> = [];

  for (const z of alle) {
    // Das Fenster greift VOR allem anderen: eine Zeile ausserhalb soll weder
    // als „ohne Ergebnis" noch als „unlesbar" gezaehlt werden, sonst stuenden
    // in der Antwort Zahlen, die sich auf verschiedene Mengen beziehen.
    if (grenze !== null) {
      const d = tag(z?.updatedAt);
      if (d === null) { ohneDatumImFenster++; continue; }
      if (d < grenze) { ausserhalbFenster++; continue; }
    }
    const m = notizen(z?.notes ?? null);
    if (m === null) {
      // Ohne lesbare Notizen lässt sich das Etikett nicht prüfen. Die Zeile
      // wird NICHT stillschweigend mitgerechnet — sie könnte ein KEIN_PNL
      // sein. Gemeldet statt geraten.
      unlesbar++;
      continue;
    }
    const grund = etikett(m.exitReason);
    if (grund && ETIKETTEN_OHNE_ERGEBNIS.includes(grund)) { ohneErgebnis++; continue; }
    if (m.rekonstruiert === true) rekonstruiert++;   // zählt mit, aber sichtbar
    const pnl = typeof z?.profitLoss === "number" && Number.isFinite(z.profitLoss)
      ? z.profitLoss : null;
    if (pnl === null) { unlesbar++; continue; }
    gewertet.push({
      pnl,
      herkunft: `${etikett(z?.result) || "—"}/${grund || "—"}`,
      datum: tag(z?.updatedAt),
    });
  }

  const werte = gewertet.map((g) => g.pnl);
  // Die ungerundete Summe trägt die Rechnung; gerundet wird erst zur Ausgabe.
  const roh = werte.reduce((a, b) => a + b, 0);
  const summePnl = Number(roh.toFixed(2));
  const winZeilen = gewertet.filter((g) => g.pnl > BREAKEVEN_GRENZE);
  const lossZeilen = gewertet.filter((g) => g.pnl < -BREAKEVEN_GRENZE);
  const beZeilen = gewertet.filter((g) => Math.abs(g.pnl) <= BREAKEVEN_GRENZE);
  const wins = winZeilen.map((g) => g.pnl);
  const losses = lossZeilen.map((g) => g.pnl);

  // Dreimal DIESELBE Gruppierung — aus einer Funktion, nicht dreimal gebaut.
  //
  // Breakeven: ein echter Breakeven und eine Zeile, deren P&L nie geschrieben
  // wurde, sind an der ZAHL nicht zu unterscheiden — am Etikett schon.
  //
  // Gewinner/Verlierer: der Einstieg verlangt R/R ≥ 1.5. Woran die Gewinner
  // tatsächlich enden — und mit welchem Ø — ist die Frage, ohne die sich über
  // die Ausstiegsschwellen nicht entscheiden lässt.
  const breakevenHerkunft = herkunftListe(beZeilen);
  const gewinnHerkunft = herkunftListe(winZeilen);
  const verlustHerkunft = herkunftListe(lossZeilen);

  // Der Massstab: bis wann liefen die Trades MIT echtem Ergebnis?
  const zuletztEntschieden = gewertet
    .filter((g) => Math.abs(g.pnl) > BREAKEVEN_GRENZE && g.datum !== null)
    .reduce<string | null>((a, g) => (a === null || (g.datum as string) > a ? g.datum : a), null);

  const entschieden = wins.length + losses.length;
  const basis: EwErgebnis = {
    ...leer,
    ohneErgebnis, rekonstruiert, unlesbar, ausserhalbFenster, ohneDatumImFenster,
    gewertet: gewertet.length,
    wins: wins.length, losses: losses.length, breakeven: beZeilen.length, entschieden,
    summePnl, breakevenHerkunft, gewinnHerkunft, verlustHerkunft, zuletztEntschieden,
  };

  if (gewertet.length < MIN_TRADES) {
    return {
      ...basis,
      belastbar: false,
      grund: `nur ${gewertet.length} gewertete Trades — unter ${MIN_TRADES} `
        + "verschiebt ein einziger Ausreisser das Ergebnis zu stark",
    };
  }

  const trefferquote = wins.length / gewertet.length;
  const avgGewinn = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgVerlust = losses.length
    ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  // DER ERWARTUNGSWERT IST DER DURCHSCHNITT. Nicht mehr und nicht weniger.
  // In dieser Form kann er der ausgewiesenen Summe nicht widersprechen —
  // genau das war der Fehler vom 26.10.
  const ew = roh / gewertet.length;
  const rohEntschieden = wins.reduce((a, b) => a + b, 0) + losses.reduce((a, b) => a + b, 0);

  return {
    ...basis,
    trefferquote: Number((trefferquote * 100).toFixed(1)),
    verlustquote: Number((losses.length / gewertet.length * 100).toFixed(1)),
    trefferquoteEntschieden: entschieden
      ? Number((wins.length / entschieden * 100).toFixed(1)) : null,
    breakevenAnteil: Number((beZeilen.length / gewertet.length * 100).toFixed(1)),
    avgGewinn: Number(avgGewinn.toFixed(2)),
    avgVerlust: Number(avgVerlust.toFixed(2)),
    rr: avgVerlust > 0 ? Number((avgGewinn / avgVerlust).toFixed(2)) : null,
    breakevenQuote: (avgGewinn + avgVerlust) > 0
      ? Number((avgVerlust / (avgGewinn + avgVerlust) * 100).toFixed(1)) : null,
    erwartungswert: Number(ew.toFixed(2)),
    erwartungswertEntschieden: beZeilen.length > 0 && entschieden > 0
      ? Number((rohEntschieden / entschieden).toFixed(2)) : null,
    belastbar: true,
    grund: "",
  };
}

/**
 * Der Text für Telegram. Als eigene Funktion, damit ein Prüfer ihn
 * AUSFÜHREN kann — und damit die Zahlen nur an einer Stelle formatiert
 * werden.
 */
export function erwartungswertText(e: EwErgebnis): string {
  const z: string[] = ["📊 <b>Erwartungswert</b>", ""];
  // EINE Zeilenform für alle drei Aufschlüsselungen. Drei Kopien wären drei
  // Stellen, an denen eine davon still ihre Spanne oder ihren Ø verliert.
  const herkunftZeile = (h: EwHerkunft): string => {
    const sp = h.von === null || h.bis === null ? "ohne Datum"
      : h.von === h.bis ? h.von : `${h.von} … ${h.bis}`;
    const s = h.schnitt === null ? "" : ` · Ø ${h.schnitt}`;
    return `  ${h.etikett}: <b>${h.anzahl}</b>${s}  (${sp})`;
  };
  z.push(e.fensterTage === null
    ? "Zeitraum: <b>alles</b>  (<code>/edge 60</code> = nur letzte 60 Tage)"
    : `Zeitraum: <b>letzte ${e.fensterTage} Tage</b>  (<code>/edge</code> = alles)`);
  z.push(`Geschlossene Zeilen: <b>${e.gesamt}</b>`);
  if (e.ausserhalbFenster > 0) z.push(`  vor dem Fenster: ${e.ausserhalbFenster}`);
  // Ohne Datum laesst sich eine Zeile nicht einordnen. Sie wird gemeldet,
  // nicht stillschweigend mitgerechnet — und auch nicht still verworfen.
  if (e.ohneDatumImFenster > 0) {
    z.push(`  ohne Datum, nicht einordenbar: ${e.ohneDatumImFenster}`);
  }
  if (e.ohneErgebnis > 0) z.push(`  ohne Ergebnis (KEIN_PNL/NIE_BESTAETIGT): ${e.ohneErgebnis}`);
  if (e.unlesbar > 0) z.push(`  unlesbar/ohne P&L: ${e.unlesbar}`);
  z.push(`Gewertet: <b>${e.gewertet}</b>  (${e.wins} Gewinn / ${e.losses} Verlust `
    + `/ ${e.breakeven} Breakeven)`);
  // Steht BEWUSST hier und nicht unter „ohne Ergebnis": gezählt werden die
  // Zeilen, die den Ausschluss PASSIERT haben. Als „davon" unter der
  // Ausschlusszeile ergab das am 26.10. die unmögliche Lesart „33 von 31".
  if (e.rekonstruiert > 0) z.push(`  davon rekonstruiert: ${e.rekonstruiert}`);
  z.push(`Summe P&L: <b>${e.summePnl}</b>`);
  z.push("");

  if (!e.belastbar) {
    z.push(`⚠️ <b>Noch nicht belastbar</b> — ${e.grund}.`);
    z.push("Die Zahlen oben stimmen, eine Entscheidung ueber Stop und Ziel");
    z.push("traegt darauf aber nicht.");
    return z.join("\n");
  }

  const ew = e.erwartungswert ?? 0;
  z.push(ew > 0
    ? `✅ <b>Erwartungswert: +${ew} je gewertetem Trade</b> — das System hat einen Edge.`
    : `❌ <b>Erwartungswert: ${ew} je gewertetem Trade</b> — kein Edge. Das Konto `
      + "sinkt langfristig, egal wie viele gruene Trades dazwischen liegen.");
  // Die Summenprobe steht MIT in der Antwort. Am 26.10. widersprachen sich
  // Erwartungswert und Summe um den Faktor 5.3, und nichts in der Nachricht
  // hat darauf hingewiesen.
  z.push(`Summenprobe: ${ew} × ${e.gewertet} = ${(ew * e.gewertet).toFixed(2)} `
    + `(Summe: ${e.summePnl})`);
  if (e.erwartungswertEntschieden !== null) {
    z.push(`Ohne die ${e.breakeven} Breakeven: <b>${e.erwartungswertEntschieden}</b> `
      + `je entschiedenem Trade.`);
  }
  z.push("");

  z.push(`Trefferquote: <b>${e.trefferquote} %</b> von ${e.gewertet} gewerteten`);
  if (e.trefferquoteEntschieden !== null && e.breakeven > 0) {
    z.push(`              <b>${e.trefferquoteEntschieden} %</b> von ${e.entschieden} entschiedenen`);
  }
  z.push(`Ø Gewinn: <b>${e.avgGewinn}</b>   Ø Verlust: <b>${e.avgVerlust}</b>`);
  z.push(`R/R: <b>${e.rr ?? "—"} : 1</b>`);
  if (e.breakevenQuote !== null) {
    z.push(`Dafuer noetige Trefferquote: <b>${e.breakevenQuote} %</b> (der entschiedenen)`);
  }

  // WORAN DIE TRADES ENDEN.
  //
  // Der Einstieg verlangt R/R ≥ 1.5 (`ai-analysis-engine.ts:911`). Liegt das
  // REALISIERTE R/R darunter, muss der Unterschied beim Ausstieg entstehen —
  // und diese Aufschlüsselung sagt, bei welchem. Der Ø je Etikett ist dabei
  // die eigentliche Spalte: ein Ausstieg, der im Schnitt einen Bruchteil des
  // Ziels bringt, erklärt die Lücke, ein Etikett ohne Ø erklärt nichts.
  if (e.gewinnHerkunft.length > 0 || e.verlustHerkunft.length > 0) {
    z.push("");
    z.push("<b>Woran die Trades enden</b> (result/exitReason · Ø P&L):");
    if (e.gewinnHerkunft.length > 0) {
      z.push(`Gewinner (${e.wins}):`);
      for (const h of e.gewinnHerkunft) z.push(herkunftZeile(h));
    }
    if (e.verlustHerkunft.length > 0) {
      z.push(`Verlierer (${e.losses}):`);
      for (const h of e.verlustHerkunft) z.push(herkunftZeile(h));
    }
  }

  // Die Breakeven-Herkunft. Bei einem hohen Anteil ist sie die wichtigste
  // Zeile der ganzen Antwort: eine Zeile, deren P&L nie geschrieben wurde,
  // steht wegen `Float @default(0)` auf exakt 0 und sieht aus wie ein
  // sauberer Breakeven.
  if (e.breakeven > 0 && (e.breakevenAnteil ?? 0) >= BE_ANTEIL_WARNUNG) {
    z.push("");
    z.push(`⚠️ <b>${e.breakevenAnteil} % der gewerteten Zeilen sind Breakeven.</b>`);
    z.push("Herkunft (result/exitReason) — mit Zeitspanne:");
    for (const h of e.breakevenHerkunft) z.push(herkunftZeile(h));
    if (e.zuletztEntschieden !== null) {
      z.push(`Zum Vergleich — letzter Trade MIT Ergebnis: <b>${e.zuletztEntschieden}</b>.`);
      z.push("Endet ein Etikett lange davor, ist es Altbestand. Reicht es bis");
      z.push("dorthin, wird es HEUTE noch erzeugt.");
    }
    z.push("Ist darunter ein Etikett ohne echten Schlusskurs, wurde dort nie ein");
    z.push("P&L geschrieben — dann ist der Wert oben zu GUT, nicht zu schlecht.");
  }

  if (ew <= 0 && e.breakevenQuote !== null && e.trefferquoteEntschieden !== null) {
    const fehlt = Number((e.breakevenQuote - e.trefferquoteEntschieden).toFixed(1));
    z.push("");
    z.push(`Zwei Hebel: Trefferquote der entschiedenen um <b>${fehlt} Punkte</b> `
      + "heben — oder das R/R verbessern, dann sinkt die noetige Quote.");
  }
  return z.join("\n");
}
