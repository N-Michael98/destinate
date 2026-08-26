import { MarketFeedStatus, FeedSource } from "./market-types";
import { priceCache } from "./price-cache";

// ── Was hier bis zum 26.08. stand ────────────────────────────────────────────
//
// Drei fest eingebaute Zeilen:
//   TRADINGVIEW  connected: true,  latencyMs: 20
//   CAPITAL_COM  connected: false, latencyMs: 0
//   IC_MARKETS   connected: false, latencyMs: 0
//
// Beide Aussagen über die ersten zwei Quellen waren FALSCH, und zwar in
// entgegengesetzte Richtungen:
//
//   • TradingView liefert in diesem Programm überhaupt keine Kurse. Es gibt
//     genau zwei Fundstellen (`app/page.tsx`): das eingebettete Chart-Widget
//     und ein Link. Kein einziger Datenabruf. "connected: true, 20 ms" war
//     eine erfundene Zahl über eine Verbindung, die es nicht gibt.
//   • Capital.com IST der Live-Broker dieses Programms — und stand hier
//     dauerhaft auf "nicht verbunden".
//
// Die Zeilen wurden von `/api/market-data/status` unverändert ausgeliefert.
//
// Jetzt wird der Zustand aus dem ABGELEITET, was wirklich im Cache liegt: jeder
// Eintrag trägt seine Herkunft und seinen Empfangszeitpunkt. Es gibt hier
// nichts mehr zu erfinden — steht keine Zeile auf "connected", dann ist auch
// wirklich kein Kurs dieser Quelle da.
//
// `latencyMs` ist ersatzlos entfallen: dieses Programm misst keine
// Feed-Latenz. Eine Zahl auszugeben, die niemand gemessen hat, ist genau der
// Fehler, der hier behoben wird. An ihrer Stelle steht das Alter des jüngsten
// Kurses — das ist messbar und für die Frage "sind die Kurse live?" die
// nützlichere Angabe.

/** Quellen, die in diesem Programm tatsächlich Kurse liefern KÖNNEN. */
const PREIS_QUELLEN: FeedSource[] = ["CAPITAL_COM", "PYTHON_YFINANCE"];

/** Quellen, die hier grundsätzlich keine Kurse liefern — mit dem Grund.
 *  Sie bleiben sichtbar, damit ihr Fehlen erklärt ist statt unbemerkt. */
const OHNE_PREISE: Record<string, string> = {
  TRADINGVIEW: "nur Chart-Widget in der Oberfläche, kein Datenabruf",
  IC_MARKETS: "Broker für Orders angebunden, wird nicht als Kursquelle genutzt",
};

export class MarketHealth {
  getStatus(): MarketFeedStatus[] {
    const jetzt = Date.now();
    const updatedAt = new Date().toISOString();
    const alle = priceCache.getAll();

    const ausQuellen = PREIS_QUELLEN.map((source): MarketFeedStatus => {
      const eigene = alle.filter((p) => p.source === source);
      const juengste = eigene.length
        ? Math.max(...eigene.map((p) => Date.parse(p.receivedAt)))
        : null;

      return {
        source,
        connected: eigene.length > 0,
        prices: eigene.length,
        ageMinutes:
          juengste === null
            ? null
            : Number(((jetzt - juengste) / 60000).toFixed(1)),
        updatedAt,
        note:
          eigene.length > 0
            ? `${eigene.length} Kurse im Cache`
            : "keine Kurse im Cache",
      };
    });

    const stumme = (Object.keys(OHNE_PREISE) as FeedSource[]).map(
      (source): MarketFeedStatus => ({
        source,
        connected: false,
        prices: 0,
        ageMinutes: null,
        updatedAt,
        note: OHNE_PREISE[source],
      })
    );

    return [...ausQuellen, ...stumme];
  }
}

export const marketHealth = new MarketHealth();
