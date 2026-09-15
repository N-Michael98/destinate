/**
 * WELCHE KONTEN DIE SCHUTZSCHICHTEN ÜBERHAUPT SEHEN (15.09.).
 *
 * ANLASS. Am 15.09. nachgemessen: der ExecutionAgent schickte jede Order an
 * BEIDE Broker, aber sämtliche Schutzschichten rechnen mit dem Capital-Konto
 * und der Capital-Positionsliste:
 *
 *   Schutz                          sieht      sieht IC?
 *   Tagesverlust-Grenze 3 %         Capital    nein
 *   Wochenverlust-Grenze 6 %        Capital    nein
 *   Gesamt-Drawdown 15 %            Capital    nein
 *   Exposure-Grenze 20 %            Capital    nein
 *   max. 6 gleichzeitige Positionen Capital    nein
 *   Duplikat-/Pyramiding-Schutz     Capital    nein
 *   Korrelations-Filter             Capital    nein
 *
 * IC wurde dabei mit dem EIGENEN Kontostand dimensioniert — 19864.27 gegen
 * 1562.14, also das 12.7-fache Risiko je Trade. Die Ausführung dort ist
 * seit dem 15.09. per Einstellung abgeschaltet (`icMarketsExecutionEnabled`,
 * Standard AUS).
 *
 * WOZU DIESE DATEI. Der Nutzer hat vorgegeben: vorerst nur Capital.com, aber
 * so gebaut, dass IC später dazukommen kann. Genau das leistet sie — sie ist
 * die EINE Stelle, an der steht, welche Konten unter Schutz stehen und welche
 * handeln, ohne beobachtet zu werden.
 *
 * Solange ein Broker in `nichtUeberwacht` steht, ist das kein Versehen mehr,
 * sondern eine benannte Lücke: der Aufrufer meldet sie, und der Prüfer
 * `safety-nets` hält fest, dass sie gemeldet wird.
 *
 * KEINE AUSSENWELT. Alles kommt als Argument herein — damit ist die
 * Entscheidung ohne Broker, ohne Netz und ohne Datenbank ausführbar und
 * damit beweisbar.
 */

export type BrokerName = "CAPITAL_COM" | "IC_MARKETS";

export interface UeberwachtesKonto {
  broker: BrokerName;
  /** Kontostand in Kontowährung. */
  balance: number;
  /** Freie Margin, falls der Broker sie liefert — sonst null. */
  available: number | null;
}

export interface RisikoUmfang {
  /** Konten, die von den Verlust- und Drawdown-Grenzen erfasst werden. */
  konten: UeberwachtesKonto[];
  /** Broker, die Orders bekommen, aber von KEINER Grenze erfasst sind.
   *  Muss leer sein — ist er es nicht, gehört das ins Log. */
  nichtUeberwacht: BrokerName[];
}

/**
 * Bestimmt den Umfang der Risikoüberwachung.
 *
 * `icFuehrtAus` ist bewusst EIN Wahrheitswert und nicht "Sitzung steht":
 * entscheidend ist, ob IC wirklich Orders bekommt (Sitzung UND Einstellung).
 * Nur dann ist ein unbeobachtetes Konto ein Problem.
 *
 * WIE IC SPÄTER DAZUKOMMT — bewusst hier notiert, damit es nicht geraten
 * werden muss:
 *  1. `icFuehrtAus` bleibt der Schalter; zusätzlich `icBalance` übergeben.
 *  2. Das IC-Konto in `konten` aufnehmen statt in `nichtUeberwacht`.
 *  3. DANN erst sind die Grenzen selbst dran: sie rechnen heute mit EINEM
 *     Kontostand. Wer summiert, muss den gespeicherten Höchststand
 *     (`peak_balance`) und den Tagesstart bewusst neu setzen — sonst springt
 *     der Drawdown beim Umschalten schlagartig, weil die alte Spitze für ein
 *     kleineres Kapital galt. Das ist eine Entscheidung, keine Zeile Code.
 */
export function risikoUmfang(eingabe: {
  capitalBalance: number;
  capitalAvailable?: number | null;
  icFuehrtAus: boolean;
  icBalance?: number | null;
}): RisikoUmfang {
  const konten: UeberwachtesKonto[] = [];
  const stand = Number(eingabe.capitalBalance);
  if (Number.isFinite(stand) && stand > 0) {
    konten.push({
      broker: "CAPITAL_COM",
      balance: stand,
      available: Number.isFinite(Number(eingabe.capitalAvailable))
        ? Number(eingabe.capitalAvailable)
        : null,
    });
  }
  // IC steht HEUTE bewusst nicht in `konten` — siehe Kopfkommentar. Handelt es
  // trotzdem, ist das eine benannte Lücke und keine stille.
  const nichtUeberwacht: BrokerName[] = eingabe.icFuehrtAus ? ["IC_MARKETS"] : [];
  return { konten, nichtUeberwacht };
}

/** Summe des überwachten Kapitals. Heute genau der Capital-Kontostand. */
export function ueberwachtesKapital(umfang: RisikoUmfang): number {
  return umfang.konten.reduce((s, k) => s + k.balance, 0);
}

/**
 * Meldetext für eine Lücke — oder `null`, wenn keine besteht.
 *
 * Getrennt von der Ausgabe, damit der Prüfer den TEXT prüfen kann, ohne die
 * Konsole abzufangen.
 */
export function lueckeMeldung(umfang: RisikoUmfang): string | null {
  if (umfang.nichtUeberwacht.length === 0) return null;
  return `[risk-scope] ⚠️ ${umfang.nichtUeberwacht.join(", ")} bekommt Orders, `
    + `wird aber von KEINER Verlust- oder Drawdown-Grenze erfasst. `
    + `Ueberwacht: ${umfang.konten.map((k) => k.broker).join(", ") || "KEIN Konto"}.`;
}
