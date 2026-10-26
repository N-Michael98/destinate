/**
 * Der Erwartungswert — die Zahl, die sagt, ob das System einen Edge hat
 * (26.10.)
 *
 * ── DER ANLASS ──────────────────────────────────────────────────────────────
 *
 * „Viele grüne Trades, und das Konto sinkt trotzdem." Das ist kein Rätsel,
 * sondern eine Rechnung:
 *
 *   EW = (Trefferquote × Ø Gewinn) − (Fehlerquote × Ø Verlust)
 *
 * Eine Trefferquote von 70 % mit Ø 40 Gewinn und Ø 120 Verlust ergibt
 * 0,70·40 − 0,30·120 = −8 pro Trade. **Eine hohe Trefferquote ist wertlos,
 * wenn die Verluste zu gross sind.**
 *
 * Diese Zahl wurde im ganzen Programm **nirgends** gerechnet (gesucht in
 * `frontend/lib`, kein Treffer).
 *
 * ── WARUM DIE DATENQUALITÄT MIT INS ERGEBNIS GEHÖRT ────────────────────────
 *
 * Am 30.09. kam heraus, dass jeder Trade ZWEI Journal-Zeilen erzeugte: die
 * echte starb als `KEIN_PNL` mit P&L 0 / BREAKEVEN, die rekonstruierte trug
 * das echte Ergebnis. `echteGeschlosseneTrades()` liest die Notizen **nicht**
 * — beide Zeilen gehen bis heute in jede Statistik.
 *
 * Ein Erwartungswert auf diesen Daten wäre **wertlos**: die Trefferquote
 * verdünnt, der Ø Gewinn verdünnt, die Trade-Zahl verdoppelt. Und schlimmer —
 * er würde zu falschen Schlüssen über Stop und Ziel führen.
 *
 * Deshalb liefert diese Funktion **beide** Zahlen: roh und bereinigt, mit der
 * Differenz als eigener Posten. Wer nur eine davon sieht, kann nicht
 * entscheiden, ob er der anderen trauen darf.
 *
 * ── UND EIN AUSFALL GIBT SICH NICHT ALS ERGEBNIS AUS ────────────────────────
 *
 * Unter `MIN_TRADES` wird **kein** Erwartungswert ausgegeben, sondern
 * `belastbar: false` mit Grund. Die Projektregel seit dem 07.09.: ein
 * Rückfallwert an einer Stelle, die über Geld entscheidet, macht aus
 * „unbekannt" eine Messung. Zehn Trades, wie anderswo üblich, sind für eine
 * Entscheidung über Stop und Ziel **zu wenig** — bei 10 Trades verschiebt ein
 * einziger Ausreisser die Trefferquote um 10 Punkte.
 */

import { ETIKETTEN_OHNE_ERGEBNIS } from "../capital-com/capital-trade-tracker";

/** Ab hier ist die Rechnung belastbar genug für eine Entscheidung. */
export const MIN_TRADES = 30;

/** Was ein Gewinn/Verlust ist — Spread-Verluste sind echte Verluste (09.08.). */
export const BREAKEVEN_GRENZE = 0.01;

export type TradeZeile = {
  profitLoss: number | null;
  notes: string | null;
};

export type EwErgebnis = {
  /** Alle geschlossenen Zeilen, die aus der Datenbank kamen. */
  gesamt: number;
  /** Zeilen mit `NIE_BESTAETIGT` / `KEIN_PNL` — kein Ergebnis, nur ein Etikett. */
  ohneErgebnis: number;
  /** Zeilen, die aus einer Broker-Position rekonstruiert wurden. */
  rekonstruiert: number;
  /** Zeilen ohne lesbare Notizen — gezählt, nicht still verworfen. */
  unlesbar: number;
  /** Was nach dem Bereinigen übrig bleibt und gerechnet wird. */
  gewertet: number;

  wins: number;
  losses: number;
  breakeven: number;

  /** Prozent, auf eine Stelle. `null` wenn nichts zu rechnen war. */
  trefferquote: number | null;
  avgGewinn: number | null;
  avgVerlust: number | null;
  /** Ø Gewinn / Ø Verlust. `null` wenn es keine Verluste gab. */
  rr: number | null;
  /** Ab welcher Trefferquote das System bei diesem R/R die Null hält. */
  breakevenQuote: number | null;

  /** Die Zahl, um die es geht — pro Trade. `null` wenn nicht belastbar. */
  erwartungswert: number | null;
  /** Summe aller gewerteten P&L — zum Abgleich mit dem Konto. */
  summePnl: number;

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

export function erwartungswert(zeilen: ReadonlyArray<TradeZeile> | null | undefined): EwErgebnis {
  const alle = Array.isArray(zeilen) ? zeilen : [];
  const leer: EwErgebnis = {
    gesamt: alle.length, ohneErgebnis: 0, rekonstruiert: 0, unlesbar: 0, gewertet: 0,
    wins: 0, losses: 0, breakeven: 0,
    trefferquote: null, avgGewinn: null, avgVerlust: null, rr: null, breakevenQuote: null,
    erwartungswert: null, summePnl: 0,
    belastbar: false, grund: "",
  };

  let ohneErgebnis = 0, rekonstruiert = 0, unlesbar = 0;
  const gewertet: number[] = [];

  for (const z of alle) {
    const m = notizen(z?.notes ?? null);
    if (m === null) {
      // Ohne lesbare Notizen lässt sich das Etikett nicht prüfen. Die Zeile
      // wird NICHT stillschweigend mitgerechnet — sie könnte ein KEIN_PNL
      // sein. Gemeldet statt geraten.
      unlesbar++;
      continue;
    }
    const grund = String(m.exitReason ?? "").trim().toUpperCase();
    if (grund && ETIKETTEN_OHNE_ERGEBNIS.includes(grund)) { ohneErgebnis++; continue; }
    if (m.rekonstruiert === true) rekonstruiert++;   // zählt mit, aber sichtbar
    const pnl = typeof z?.profitLoss === "number" && Number.isFinite(z.profitLoss)
      ? z.profitLoss : null;
    if (pnl === null) { unlesbar++; continue; }
    gewertet.push(pnl);
  }

  const summePnl = Number(gewertet.reduce((a, b) => a + b, 0).toFixed(2));
  const wins = gewertet.filter((p) => p > BREAKEVEN_GRENZE);
  const losses = gewertet.filter((p) => p < -BREAKEVEN_GRENZE);
  const breakeven = gewertet.length - wins.length - losses.length;

  const basis: EwErgebnis = {
    ...leer,
    ohneErgebnis, rekonstruiert, unlesbar,
    gewertet: gewertet.length,
    wins: wins.length, losses: losses.length, breakeven,
    summePnl,
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
  // Breakeven-Trades zählen als Nicht-Gewinn: die Fehlerquote ist 1 − Treffer.
  const ew = trefferquote * avgGewinn - (1 - trefferquote) * avgVerlust;

  return {
    ...basis,
    trefferquote: Number((trefferquote * 100).toFixed(1)),
    avgGewinn: Number(avgGewinn.toFixed(2)),
    avgVerlust: Number(avgVerlust.toFixed(2)),
    rr: avgVerlust > 0 ? Number((avgGewinn / avgVerlust).toFixed(2)) : null,
    breakevenQuote: (avgGewinn + avgVerlust) > 0
      ? Number((avgVerlust / (avgGewinn + avgVerlust) * 100).toFixed(1)) : null,
    erwartungswert: Number(ew.toFixed(2)),
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
  if (e.rekonstruiert > 0) z.push(`  davon rekonstruiert: ${e.rekonstruiert}`);
  if (e.unlesbar > 0) z.push(`  unlesbar/ohne P&L: ${e.unlesbar}`);
  z.push(`Gewertet: <b>${e.gewertet}</b>  (${e.wins}W / ${e.losses}L / ${e.breakeven}BE)`);
  z.push(`Summe P&L: <b>${e.summePnl}</b>`);
  z.push("");

  if (!e.belastbar) {
    z.push(`⚠️ <b>Noch nicht belastbar</b> — ${e.grund}.`);
    z.push("Die Zahlen oben stimmen, eine Entscheidung ueber Stop und Ziel");
    z.push("traegt darauf aber nicht.");
    return z.join("\n");
  }

  z.push(`Trefferquote: <b>${e.trefferquote} %</b>`);
  z.push(`Ø Gewinn: <b>${e.avgGewinn}</b>   Ø Verlust: <b>${e.avgVerlust}</b>`);
  z.push(`R/R: <b>${e.rr ?? "—"} : 1</b>`);
  if (e.breakevenQuote !== null) {
    z.push(`Dafuer noetige Trefferquote: <b>${e.breakevenQuote} %</b>`);
  }
  z.push("");
  const ew = e.erwartungswert ?? 0;
  z.push(ew > 0
    ? `✅ <b>Erwartungswert: +${ew} pro Trade</b> — das System hat einen Edge.`
    : `❌ <b>Erwartungswert: ${ew} pro Trade</b> — kein Edge. Das Konto sinkt `
      + "langfristig, egal wie viele gruene Trades dazwischen liegen.");
  if (ew <= 0 && e.breakevenQuote !== null && e.trefferquote !== null) {
    const fehlt = Number((e.breakevenQuote - e.trefferquote).toFixed(1));
    z.push("");
    z.push(`Zwei Hebel: Trefferquote um <b>${fehlt} Punkte</b> heben — oder `
      + "das R/R verbessern, dann sinkt die noetige Quote.");
  }
  return z.join("\n");
}
