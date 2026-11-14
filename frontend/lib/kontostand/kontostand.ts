/**
 * EIN Kontostand — EINE Lesart (14.11.)
 *
 * ANLASS. Zwei Order-Routen, zwei Lesarten für dieselbe Eingabe. Gemessen
 * am 14.11. mit demselben `orderBody`, das `MarketScannerPanel` an BEIDE
 * Routen schickt (`Promise.all`, dieselbe Nachricht):
 *
 *     Eingabe      Capital                      IC Markets
 *     fehlt        400                          `?? 10000` → echte Grösse
 *     0            400 (`!0` ist wahr)          durch → Volumen MIN_UNITS
 *     NaN          400                          durch → Volumen NaN
 *     Infinity     durch, von MAX_SIZE geklemmt durch → Volumen Infinity
 *     -500         durch, auf MIN_SIZE geklemmt durch → MIN_UNITS
 *     "abc"        DURCH (`!"abc"` ist falsch)  durch → NaN
 *
 * Ein geleertes Eingabefeld ist dabei nicht theoretisch:
 * `MarketScannerPanel` liest `Number(e.target.value)`, und `Number("")`
 * ist **0**. Capital weist das ab, IC platzierte eine Order mit der
 * Mindestgrösse — dieselbe Nachricht, zwei Ergebnisse.
 *
 * WARUM EINE EIGENE DATEI. Dieselbe Begründung wie bei `lesbareRichtung`
 * (03.11.), `htmlSicher` (31.10.) und `alterStunden` (08.11.): als Ausdruck
 * in zwei Routen wäre die Entscheidung **zweimal** vorhanden und nur
 * strukturell prüfbar. Genau diese Dopplung hat am 08.11. bei Capital und
 * IC drei Erfindungen nebeneinander stehen lassen — ein Fix an einer Stelle
 * beantwortet nicht, wo die Klasse sonst noch steckt (25.10.).
 *
 * EINE ZEICHENKETTE WIRD ABGEWIESEN, nicht gelesen. Bei der Richtung ist
 * die kanonische Form eine Zeichenkette, hier ist sie eine **Zahl**:
 * `"5000"` heisst, dass der Aufrufer den falschen Typ schickt. Das zu
 * übersetzen würde seinen Fehler verdecken, und `"5 000"` / `"5,000"`
 * öffnete eine Parser-Frage, die niemand gestellt hat. Bei einer Order ist
 * ein 400 mit Grund besser als eine Grösse auf Verdacht.
 *
 * ALLES UNBRAUCHBARE WIRD `null` — NICHT 10000. Ein erfundener Kontostand
 * an einer Stelle, die über die Positionsgrösse entscheidet, ist die
 * Fehlerklasse vom 07.09.: er macht aus „unbekannt" eine Messung. Und
 * `Number.isFinite` steht davor, weil `NaN > 0` **falsch** und
 * `Infinity > 0` **wahr** ist — ohne den Riegel käme ein unendlicher Stand
 * durch, und `Math.max(Infinity, step)` in der IC-Grössenrechnung ist
 * wieder `Infinity`.
 */

/**
 * Einen rohen Kontostand als Zahl lesen — oder `null`.
 *
 * Gültig ist ausschliesslich eine **endliche Zahl grösser als 0**. Ein
 * Kontostand von 0 ist kein handelbares Konto; negativ, `NaN`, `±Infinity`,
 * Zeichenketten, `null`, `undefined` und Objekte sind unbrauchbar.
 */
export function lesbarerKontostand(roh: unknown): number | null {
  if (typeof roh !== "number") return null;
  if (!Number.isFinite(roh)) return null;
  if (roh <= 0) return null;
  return roh;
}

/**
 * WARUM er unbrauchbar ist — für die Fehlermeldung der Route.
 *
 * „ungültig" allein sagt dem Aufrufer nicht, ob er das Feld vergessen, eine
 * Zeichenkette geschickt oder ein leeres Formular abgesendet hat. Drei
 * Lagen, drei verschiedene nächste Schritte — die Regel „eine Diagnose darf
 * im interessanten Fall nicht schweigen".
 *
 * Gibt `null` zurück, wenn der Wert BRAUCHBAR ist. So kann die Route beides
 * aus einer Quelle lesen, ohne die Prüfung zu wiederholen.
 */
export function kontostandGrund(roh: unknown): string | null {
  if (lesbarerKontostand(roh) !== null) return null;
  if (roh === undefined || roh === null) return "fehlt";
  if (typeof roh !== "number") return `keine Zahl (${typeof roh})`;
  if (Number.isNaN(roh)) return "NaN — ein leeres Eingabefeld ergibt NaN oder 0";
  if (!Number.isFinite(roh)) return "unendlich";
  if (roh === 0) return "0 — ein leeres Eingabefeld ergibt 0";
  return "nicht grösser als 0";
}
