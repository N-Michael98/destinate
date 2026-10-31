/**
 * Fremden Text für eine Telegram-Nachricht entschärfen (31.10.).
 *
 * WARUM DAS EIN EIGENES MODUL IST
 *
 * Telegram verschickt unsere Nachrichten mit `parse_mode: "HTML"`. Ein
 * einzelnes rohes `<` in einem fremden Text macht die ganze Nachricht
 * unlesbar: Telegram antwortet mit HTTP 200 und
 * `{ok:false, description:"Can't parse entities …"}` — die Nachricht kommt
 * dann **gar nicht** an. Seit dem 26.10. steht der Grund immerhin im
 * Konsolen-Log, der Empfänger sieht trotzdem nichts.
 *
 * Und das ist kein konstruierter Fall. `orchestrator-agent.ts:1002` sendet
 * wörtlich:
 *
 *     reason: `Confidence ${o.gpt.confidence} < Schwelle ${threshold}`
 *
 * Dieser Text landet als Tor-Grund in der Tagessumme und wird von `/status`
 * und von der Tagesbilanz ausgegeben. Genau dieses Tor war am 30.10. der
 * Live-Fall (zwei GO, beide an einem Tor nach dem GO gestorben).
 *
 * Die Funktion stand bis heute **nur** in `zyklus-bilanz.ts`. `/status`
 * (29./30.10. gebaut) hatte sie nicht — „ein Fix an einer Stelle beantwortet
 * nicht, wo die Klasse sonst noch steckt" (25.10.).
 *
 * Eine zweite Kopie wäre eine zweite Stelle, an der sie auseinanderlaufen
 * kann — dieselbe Begründung wie bei `herkunftListe()` in `/edge`. Deshalb
 * EIN Modul, und zwar ein **reines**: keine Importe, keine Seiteneffekte,
 * kein geteilter Zustand. `handels-lage.ts` darf es importieren, ohne sich
 * an den Bus-, Redis- und Telegram-Modulgraphen zu binden.
 *
 * REIHENFOLGE: `&` MUSS zuerst ersetzt werden. Andernfalls würde das `&`
 * der eben erzeugten `&lt;` gleich wieder zu `&amp;lt;` — gerechnet und
 * im Prüfstand festgehalten, nicht behauptet.
 */
export function htmlSicher(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
