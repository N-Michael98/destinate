/**
 * BUY/SELL — EINE Lesart für die Richtung (03.11.)
 *
 * ANLASS. `/hebel` zeigte am 02.11. in der Dimension „Richtung":
 *
 *     BUY 585 · SELL 226 · LONG 3        (Summe 814)
 *
 * Die drei `LONG` waren der Fingerabdruck eines Vokabular-Bruchs: der Bot
 * schreibt `"BUY"`/`"SELL"` (`capital-trade-tracker.ts`, Typ
 * `TradeRecord.direction: "BUY" | "SELL"`), das Eingabeformular in
 * `/trading-journal` schrieb dagegen `"LONG"`/`"SHORT"` ungeprüft in
 * dieselbe Spalte — `Trade.direction` ist im Schema nur `String`.
 *
 * WAS DAS GEKOSTET HAT. `getDirectionStats()` derselben Seite verglich mit
 * `=== "LONG"` / `=== "SHORT"` und traf damit **3 von 814** Zeilen;
 * `shortTrades` war 0. Die Seite gab trotzdem „Best Direction", zwei
 * Trefferquoten und zwei CHF-Summen aus. Und die Trade-Liste färbte jeden
 * BUY rot, weil sie `=== "LONG"` als „grün" las.
 *
 * Dieselbe Route (`/api/trades`) wurde von `app/page.tsx` mit dem
 * RICHTIGEN Vokabular gelesen (`=== "BUY"`). Zwei Leser, zwei Sprachen.
 *
 * WARUM EINE EIGENE DATEI. Die Abbildung gab es schon — als
 * `lesbareRichtung()` in `trade-feedback-engine.ts`. Dieses Modul zieht
 * aber Prisma und den Papierhandel nach sich und ist aus einer
 * Client-Komponente nicht ladbar. Eine zweite Fassung wäre eine zweite
 * Wahrheit: dieselbe Zeile hiesse dann an zwei Stellen verschieden — genau
 * der Fehler, der hier behoben wird. Deshalb liegt die Abbildung jetzt
 * hier, rein, ohne Importe, ohne Seiteneffekte, und
 * `trade-feedback-engine.ts` holt sie von hier. Dieselbe Begründung wie
 * bei `htmlSicher` (31.10.) und `redisLageMelden` (01.11.).
 *
 * LONG/SHORT WERDEN WEITER GELESEN, nicht abgewiesen: der Broker-Pfad
 * benutzt diese Wörter, und die drei Altzeilen in der Datenbank sollen
 * nicht aus der Statistik fallen. Beides ist eindeutig und muss nicht
 * geraten werden.
 *
 * ALLES ANDERE WIRD `null` — NICHT „BUY". Ein unlesbarer Wert ist
 * unbekannt, keine Richtung. Eine stille Ersatzrichtung wäre eine
 * Behauptung statt einer Messung (Regel vom 22.09.) und würde hier eine
 * Position auf die falsche Seite zählen.
 */

/** Die kanonischen Werte — das schreibt der Bot, das steht in der Spalte. */
export const RICHTUNGEN = ["BUY", "SELL"] as const;
export type Richtung = (typeof RICHTUNGEN)[number];

/**
 * Einen rohen Richtungswert als BUY/SELL lesen — oder `null`.
 *
 * Erkannt werden `BUY`/`LONG` und `SELL`/`SHORT`, unabhängig von
 * Gross-/Kleinschreibung und umgebenden Leerzeichen.
 */
export function lesbareRichtung(roh: unknown): Richtung | null {
  if (typeof roh !== "string") return null;
  const t = roh.trim().toUpperCase();
  if (t === "SELL" || t === "SHORT") return "SELL";
  if (t === "BUY" || t === "LONG") return "BUY";
  return null;
}

/**
 * Dasselbe für die ANZEIGE: ein unlesbarer Wert wird nicht versteckt.
 *
 * Eine Zeile mit einem kaputten Wert soll ihn zeigen, statt als „BUY"
 * durchzugehen — sonst sieht die Liste heil aus, während die Daten es
 * nicht sind.
 */
export function richtungAnzeige(roh: unknown): string {
  const r = lesbareRichtung(roh);
  if (r) return r;
  const t = typeof roh === "string" ? roh.trim() : "";
  return t === "" ? "—" : `${t}?`;
}
