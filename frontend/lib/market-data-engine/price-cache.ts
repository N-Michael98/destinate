import { MarketPrice } from "./market-types";

// ── Warum der Zustand auf `global` liegt (26.08.) ────────────────────────────
//
// Hier stand eine modul-scoped `private prices = new Map()`. Genau daran ist
// in diesem Projekt am 28.07. schon der Killswitch gescheitert; die Begründung
// steht wörtlich in killswitch-engine.ts:12 —
//
//   "State auf global (28.07.): vorher modul-scoped `let _state` — dadurch
//    konnten Telegram-Route und die Trading-Loops in instrumentation.ts
//    verschiedene Kopien sehen, der Killswitch hätte dort nie gegriffen."
//
// Dieser Cache hat dieselbe Bauform: **geschrieben** wird er aus dem
// Handelszyklus, **gelesen** von API-Routen. Auf einer modul-scoped Map hätte
// die Route weiterhin eine leere Kopie gesehen — die Anzeige sähe repariert
// aus, ohne es zu sein. Das ist die schlimmere Sorte Fehler, weil sie sich
// selbst verdeckt.
//
// Bewährtes Muster im Projekt: global.__killswitch_state__,
// global.__capital_session__, global.__icmarkets_session__,
// global.__last_scan_result__.
//
// Redis wäre die Alternative, ist hier aber falsch: Preise sind nach Sekunden
// wertlos, ein Überleben über Deploys hinweg bringt nichts — und `set()` müsste
// dafür async werden, was jeden Leser umbaut.
declare global {
  var __price_cache__: Map<string, MarketPrice> | undefined;
}

function speicher(): Map<string, MarketPrice> {
  if (!global.__price_cache__) global.__price_cache__ = new Map();
  return global.__price_cache__;
}

/** Wie lange gilt ein Eintrag als brauchbar? Danach wird er beim Lesen
 *  verworfen.
 *
 *  Der Handelszyklus schreibt etwa alle 2 Minuten. 10 Minuten Toleranz decken
 *  einen ausgefallenen Durchlauf ab, ohne dass ein stehengebliebener Zyklus
 *  stundenalte Kurse als aktuell ausgibt. Genau dieser Fehler ist am 02.08.
 *  schon einmal aufgetreten (ein 57 Stunden alter Nikkei-Kurs sah taufrisch
 *  aus, weil er mit `new Date()` gestempelt wurde). */
export const CACHE_MAX_ALTER_MS = 10 * 60 * 1000;

export class PriceCache {
  /** Einen Kurs ablegen.
   *
   *  `previousBid`/`previousAsk` werden aus dem **Vorgänger im Cache**
   *  gefüllt, nicht vom Aufrufer erwartet. Nur so bekommt die
   *  Regime-Einstufung überhaupt eine Bewegung zu sehen: sie rechnet
   *  `priceChangePercent` aus genau diesem Paar. Ohne Vorgänger meldet
   *  `detectTrend()` RANGING mit Score 50 — für den ersten Durchlauf ist das
   *  richtig, denn eine Bewegung ist dann tatsächlich nicht bekannt.
   *
   *  ABGELAUFENE Vorgänger werden NICHT verwendet — `this.get()` statt eines
   *  rohen Map-Zugriffs. Sonst entstünde nach einem Ausfall des
   *  Handelszyklus genau die Sorte Falschaussage, die dieses Programm
   *  wiederholt getroffen hat: stand der Zyklus drei Stunden still, wäre die
   *  Bewegung dieser drei Stunden als Bewegung EINES Zyklus ausgewiesen
   *  worden — aus +2,7 % über Nacht würde ein STRONG_BULL "gerade eben".
   *  Jetzt beginnt die Messung nach einem Ausfall sauber von vorn: ein
   *  Durchlauf ohne Vergleich, danach echte Zwei-Minuten-Deltas. */
  set(price: MarketPrice) {
    const vorher = this.get(price.symbol);
    speicher().set(price.symbol, {
      ...price,
      previousBid: vorher?.bid,
      previousAsk: vorher?.ask,
    });
  }

  get(symbol: string) {
    const p = speicher().get(symbol);
    return p && !this.istAbgelaufen(p) ? p : undefined;
  }

  /** Nur nicht abgelaufene Einträge. Abgelaufene werden dabei entfernt —
   *  ein alter Kurs darf nicht als aktueller durchgehen. */
  getAll() {
    const jetzt = Date.now();
    const raus: string[] = [];
    const gueltig: MarketPrice[] = [];
    for (const [symbol, p] of speicher()) {
      if (this.istAbgelaufen(p, jetzt)) raus.push(symbol);
      else gueltig.push(p);
    }
    for (const s of raus) speicher().delete(s);
    return gueltig;
  }

  private istAbgelaufen(p: MarketPrice, jetzt = Date.now()) {
    const t = Date.parse(p.receivedAt);
    // Unlesbarer Zeitstempel gilt als abgelaufen, NICHT als frisch (fail-safe).
    if (!Number.isFinite(t)) return true;
    return jetzt - t > CACHE_MAX_ALTER_MS;
  }

  /** Alter des jüngsten Eintrags in Minuten, oder null wenn der Cache leer
   *  ist. Für die Anzeige: unterscheidet "wird gefüllt" von "steht still". */
  alterMinuten(): number | null {
    const alle = this.getAll();
    if (alle.length === 0) return null;
    const juengste = Math.max(...alle.map((p) => Date.parse(p.receivedAt)));
    return Number(((Date.now() - juengste) / 60000).toFixed(1));
  }

  // Alias für Kompatibilität mit market-regime route — gibt aktuelle Cache-Preise zurück
  refreshPrices() {
    return this.getAll();
  }

  /** Nur für Tests und Prüfer. */
  leeren() {
    speicher().clear();
  }
}

export const priceCache = new PriceCache();

/** Der einzige Schreibweg von aussen (26.08.).
 *
 *  Bis heute rief `priceCache.set()` **niemand** auf — der Cache war dauerhaft
 *  leer und drei Ansichten lasen daraus. Diese Funktion nimmt die Marktliste
 *  entgegen, die der Handelszyklus ohnehin schon beim Broker holt: keine
 *  zusätzliche Broker-Anfrage, kein zweiter Takt, kein eigenes Rate-Limit.
 *
 *  Sie ist bewusst **anspruchsvoll bei den Eingaben**: ohne gültiges bid/ask
 *  wird nichts abgelegt. Ein Kurs von 0 oder NaN im Cache würde in der
 *  Regime-Einstufung zu einem Mittelwert 0 und einem Spread-Anteil 0 führen —
 *  also zu einer Kennzahl, der man nicht ansieht, dass sie erfunden ist.
 *  `Number.isFinite` steht hier mit Absicht: `NaN > 0` ist **false**, aber
 *  `NaN <= 0` ist es auch — ohne diese Prüfung käme ein NaN durch.
 *
 *  Rückgabe: wie viele Kurse übernommen wurden. */
export function preiseUebernehmen(
  eingang: Array<{
    symbol?: string;
    bid?: number;
    ask?: number;
    spread?: number;
    updateTime?: string;
    priceSource?: string;
  }>
): number {
  const empfangenAm = new Date().toISOString();
  let uebernommen = 0;

  for (const m of eingang) {
    const symbol = m.symbol;
    const bid = Number(m.bid);
    const ask = Number(m.ask);
    if (!symbol) continue;
    if (!Number.isFinite(bid) || bid <= 0) continue;
    if (!Number.isFinite(ask) || ask <= 0) continue;

    const spread = Number.isFinite(Number(m.spread))
      ? Number(m.spread)
      : Number((ask - bid).toFixed(5));

    priceCache.set({
      symbol,
      bid,
      ask,
      spread,
      // Der ECHTE Zeitstempel des Brokers. Fehlt er, bleibt das Feld leer —
      // NICHT mit der aktuellen Uhrzeit füllen. Genau dieser Griff hat am
      // 02.08. einen 57 Stunden alten Kurs taufrisch aussehen lassen.
      timestamp: m.updateTime ?? "",
      receivedAt: empfangenAm,
      source: m.priceSource === "CAPITAL" ? "CAPITAL_COM" : "PYTHON_YFINANCE",
    });
    uebernommen++;
  }

  return uebernommen;
}
