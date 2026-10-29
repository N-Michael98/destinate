/**
 * DIE BROKER-LAGE ALS AUSFUEHRBARE FUNKTION (28.10.)
 *
 * Warum ueberhaupt eine eigene Datei fuer drei Zeilen?
 *
 * Die Lage stand zuerst als Ternaer-Kette direkt im JSX von
 * `ExecutionQueuePositionSyncPanel`. Im Sabotage-Lauf entwischte damit genau
 * die Sabotage, auf die es ankommt: der Ausdruck `report.capitalComActive ===
 * false` steht dort ZWEIMAL (einmal fuer die Farbe, einmal fuer den Text).
 * Wird der TEXT-Zweig zerstoert und der Farb-Zweig bleibt stehen, findet eine
 * Struktur-Pruefung den Wortlaut weiter und bleibt gruen — waehrend die
 * Anzeige bei einer fehlenden Antwort wieder "nicht verbunden" behauptet.
 *
 * Das ist die Fehlerklasse vom 30.09. ("ein Regex prueft den Wortlaut, nicht
 * das Verhalten") in der Spielart "eine andere Stelle im selben Ausdruck".
 *
 * Als Funktion kann `safety-nets` sie AUSFUEHREN: mit `true`, mit `false` und
 * mit `undefined`, und die drei Antworten muessen sich unterscheiden. Eine
 * Verkuerzung auf zwei Werte ist dann nicht mehr gruen zu bekommen.
 *
 * DREIWERTIG ist der ganze Zweck: `undefined`/`null` heisst UNBEKANNT, nicht
 * "nicht verbunden". Eine stille Null macht aus "nicht abrufbar" eine
 * Messung — derselbe Fehler wie beim Kurs-Alter am 22.09. und bei
 * `integrationsStand()` am 30.09.
 *
 * Reine Funktion, keine Importe, keine Nebenwirkungen.
 */

export type BrokerArt = "verbunden" | "getrennt" | "unbekannt";

export interface BrokerLage {
  art: BrokerArt;
  text: string;
}

export function brokerLage(
  aktiv: boolean | null | undefined,
  grund: string | null | undefined
): BrokerLage {
  // `=== true` mit Absicht, nicht `if (aktiv)`: ein wahrheitswertiger
  // Vergleich machte aus jedem nicht-leeren Wert ein "verbunden".
  if (aktiv === true) {
    return { art: "verbunden", text: "● Capital.com verbunden" };
  }
  if (aktiv === false) {
    // Der Grund kommt aus `getLastReconnectError()` und kann fehlen — dann
    // wird er BENANNT, nicht erfunden. "wer den Grund nicht mitschreibt,
    // muss ihn spaeter raten" (22.09.), hier eine Ebene weiter vorn.
    const g = typeof grund === "string" && grund.trim() !== ""
      ? grund.trim()
      : "nicht gemeldet";
    return { art: "getrennt", text: `○ Capital.com nicht verbunden — Grund: ${g}` };
  }
  return {
    art: "unbekannt",
    text: "◌ Capital.com unbekannt — die Antwort trägt kein Feld `capitalComActive`",
  };
}
