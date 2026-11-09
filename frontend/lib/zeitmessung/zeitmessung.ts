/**
 * Einmal je Prozess: wie sieht ein Broker-Zeitstempel ROH aus?
 *
 * EIGENES Modul, rein bis auf die Konsolenausgabe — dieselbe Begründung wie
 * bei `htmlSicher` (31.10.), `redisLageMelden` (01.11.) und `alterStunden`
 * (08.11.): zwei Broker brauchen dieselbe Messung, und einer der Nutzer
 * (`capital-com-client.ts`) steht auf der Liste der Dateien mit erhöhtem
 * Risiko.
 *
 * ## Warum es diese Messung gibt
 *
 * Am **22.09.** kostete eine zonenlose Broker-Zeit zwei Monate: Capital.com
 * schickt `updateTime` **ohne Zonenangabe** und **kein** UTC-Feld. Als UTC
 * gelesen lag die Zeit zwei Stunden in der Zukunft, das Kurs-Alter war
 * `max(0, echt − 120)` — die eingestellten 30 Minuten wirkten wie 150. Der
 * Fehler war nur deshalb auffindbar, weil jemand den **rohen** Wert neben
 * „jetzt" gestellt hat.
 *
 * ## Warum sie jetzt beiden Brokern dient
 *
 * Für **cTrader** (IC Markets) ist bis heute **nicht gemessen**, ob eine Zone
 * mitkommt — im ganzen Repository gibt es keinen einzigen echten
 * cTrader-Zeitstempel (nachgezählt). Die Lücke ist nicht symmetrisch:
 *
 *  - Zone **vor** UTC (z. B. Zürich ohne Marker): die Zeit sieht in der
 *    **Zukunft** aus → `alterStunden` gibt `null`, und der Zeit-Exit meldet
 *    sich mit „liegt in der ZUKUNFT". **Dieser Fall ist laut.**
 *  - Zone **hinter** UTC (z. B. ein US-Server ohne Marker): die Position sieht
 *    **älter** aus → der Zeit-Exit feuert **zu früh**, und zwar **stumm**.
 *
 * Genau den zweiten Fall macht diese Zeile sichtbar, weil sie das **Format**
 * nennt und nicht nur das Vorzeichen der Abweichung.
 *
 * ## Was sie NICHT tut
 *
 * Sie rechnet nichts um und entscheidet nichts. Eine Zone zu **annehmen**,
 * ohne sie gemessen zu haben, wäre genau der Fehler vom 22.09. in neuer
 * Verpackung. Sie liefert die Belege, aus denen sich die Entscheidung dann
 * treffen lässt.
 *
 * Der Merker liegt auf `global`, nicht modul-scoped: die Broker-Clients werden
 * sowohl aus `instrumentation.ts` als auch aus API-Routen geladen, und das
 * sind **verschiedene Kopien desselben Moduls** (Regel vom 28.07.). Mit einer
 * Modulvariable würde die Zeile je Kopie einmal erscheinen statt einmal je
 * Prozess.
 */
declare global {
  // eslint-disable-next-line no-var
  var __zeitstempel_gemessen__: Record<string, boolean> | undefined;
}

/** Trägt die Zeichenkette eine Zonenangabe (`Z` oder `±hh:mm`)? */
export function hatZone(roh: unknown): boolean {
  return typeof roh === "string" && /(Z|[+-]\d{2}:?\d{2})$/i.test(roh.trim());
}

/**
 * @param quelle Log-Präfix, z. B. `"capital-com"` oder `"icmarkets"`. Es MUSS
 *   der Broker sein, von dem die Werte stammen — ein `[capital-com]` über
 *   cTrader-Daten wäre eine lügende Logzeile, die Fehlerklasse von
 *   `market-health.ts` und den zwei falschen Killswitch-Texten (27.09.).
 * @param art Welcher Abruf — eigener Merker je Art, damit `positionen` und
 *   `geschaefte` sich nicht gegenseitig verdecken.
 * @param felder Name → Rohwert. Trägt der Broker ein UTC-Zwillingsfeld, wird
 *   zusätzlich der Versatz zwischen beiden genannt (so ist der Fehler vom
 *   22.09. gefunden worden).
 */
export function zeitstempelMessen(
  quelle: string, art: string, felder: Record<string, unknown>,
): void {
  try {
    const schluessel = `${quelle}:${art}`;
    const merker = (global.__zeitstempel_gemessen__ ??= {});
    if (merker[schluessel]) return;
    merker[schluessel] = true;

    const jetzt = Date.now();
    const gelesen: Record<string, number> = {};
    const teile = Object.entries(felder).map(([k, v]) => {
      const s = v == null ? "" : String(v);
      const t = s ? Date.parse(s) : NaN;
      if (Number.isFinite(t)) gelesen[k] = t;
      const diff = Number.isFinite(t) ? `${((t - jetzt) / 60000).toFixed(1)} min` : "nicht lesbar";
      // `zone=NEIN` ist die Angabe, auf die es ankommt: ohne Marker wird die
      // Zeit als UTC gelesen, und dann ist das Alter um den Zonenversatz
      // falsch — in der einen Richtung laut, in der anderen STUMM.
      return `${k}=${s ? `"${s}"` : "FEHLT"} (zone=${hatZone(s) ? "JA" : "NEIN"}, `
        + `als UTC gelesen: ${diff} gegen jetzt)`;
    });
    const namen = Object.keys(gelesen);
    const versatz = namen.length === 2
      ? ` | Versatz ${namen[0]} − ${namen[1]} = ${((gelesen[namen[0]] - gelesen[namen[1]]) / 60000).toFixed(1)} min`
      : "";
    console.log(`[${quelle}] 🕐 Zeitstempel roh (${art}, einmal je Prozess): `
      + `${teile.join(" | ")}${versatz}`);
  } catch { /* eine Messung darf nichts stoeren */ }
}
