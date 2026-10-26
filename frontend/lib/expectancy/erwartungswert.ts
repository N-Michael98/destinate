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
};

export type EwHerkunft = { etikett: string; anzahl: number };

export type EwErgebnis = {
  /** Alle geschlossenen Zeilen, die aus der Datenbank kamen. */
  gesamt: number;
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

export function erwartungswert(zeilen: ReadonlyArray<TradeZeile> | null | undefined): EwErgebnis {
  const alle = Array.isArray(zeilen) ? zeilen : [];
  const leer: EwErgebnis = {
    gesamt: alle.length, ohneErgebnis: 0, rekonstruiert: 0, unlesbar: 0, gewertet: 0,
    wins: 0, losses: 0, breakeven: 0, entschieden: 0,
    trefferquote: null, verlustquote: null, trefferquoteEntschieden: null,
    breakevenAnteil: null,
    avgGewinn: null, avgVerlust: null, rr: null, breakevenQuote: null,
    erwartungswert: null, erwartungswertEntschieden: null, summePnl: 0,
    breakevenHerkunft: [],
    belastbar: false, grund: "",
  };

  let ohneErgebnis = 0, rekonstruiert = 0, unlesbar = 0;
  const gewertet: Array<{ pnl: number; herkunft: string }> = [];

  for (const z of alle) {
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
    gewertet.push({ pnl, herkunft: `${etikett(z?.result) || "—"}/${grund || "—"}` });
  }

  const werte = gewertet.map((g) => g.pnl);
  // Die ungerundete Summe trägt die Rechnung; gerundet wird erst zur Ausgabe.
  const roh = werte.reduce((a, b) => a + b, 0);
  const summePnl = Number(roh.toFixed(2));
  const wins = werte.filter((p) => p > BREAKEVEN_GRENZE);
  const losses = werte.filter((p) => p < -BREAKEVEN_GRENZE);
  const beZeilen = gewertet.filter((g) => Math.abs(g.pnl) <= BREAKEVEN_GRENZE);

  // Woher die Breakeven stammen. Ein echter Breakeven und eine Zeile, deren
  // P&L nie geschrieben wurde, sind an der ZAHL nicht zu unterscheiden —
  // am Etikett schon.
  const zaehler = new Map<string, number>();
  for (const g of beZeilen) zaehler.set(g.herkunft, (zaehler.get(g.herkunft) ?? 0) + 1);
  const sortiert = [...zaehler.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const breakevenHerkunft: EwHerkunft[] = sortiert.slice(0, HERKUNFT_MAX)
    .map(([e, anzahl]) => ({ etikett: e, anzahl }));
  const restEtiketten = sortiert.slice(HERKUNFT_MAX);
  if (restEtiketten.length > 0) {
    breakevenHerkunft.push({
      etikett: `weitere (${restEtiketten.length} Etiketten)`,
      anzahl: restEtiketten.reduce((a, [, n]) => a + n, 0),
    });
  }

  const entschieden = wins.length + losses.length;
  const basis: EwErgebnis = {
    ...leer,
    ohneErgebnis, rekonstruiert, unlesbar,
    gewertet: gewertet.length,
    wins: wins.length, losses: losses.length, breakeven: beZeilen.length, entschieden,
    summePnl, breakevenHerkunft,
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
  z.push(`Geschlossene Zeilen: <b>${e.gesamt}</b>`);
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

  // Die Breakeven-Herkunft. Bei einem hohen Anteil ist sie die wichtigste
  // Zeile der ganzen Antwort: eine Zeile, deren P&L nie geschrieben wurde,
  // steht wegen `Float @default(0)` auf exakt 0 und sieht aus wie ein
  // sauberer Breakeven.
  if (e.breakeven > 0 && (e.breakevenAnteil ?? 0) >= BE_ANTEIL_WARNUNG) {
    z.push("");
    z.push(`⚠️ <b>${e.breakevenAnteil} % der gewerteten Zeilen sind Breakeven.</b>`);
    z.push("Herkunft (result/exitReason):");
    for (const h of e.breakevenHerkunft) z.push(`  ${h.etikett}: ${h.anzahl}`);
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
