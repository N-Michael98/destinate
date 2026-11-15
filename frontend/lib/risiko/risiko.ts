/**
 * EIN Risikosatz — EINE Lesart (15.11.)
 *
 * ANLASS. Beide Order-Routen hatten `riskPercent: body.riskPercent ?? 1.0`.
 * Das `??` fängt `null`/`undefined` — und sonst nichts. Gemessen durch die
 * echte `executeCapitalDemoOrder` gegen einen gezählten `capitalPlaceOrder`
 * (Arbeitspunkt ungeklemmt bei Grösse 400):
 *
 *     riskPercent              size an den Broker      ok
 *     NaN / "abc"              NaN                     true
 *     +Infinity / 1e6          MAX_SIZE                true
 *     0 / -5                   MIN_SIZE                true
 *
 * Seit dem 15.11. hält `calcPositionSize` das ab — aber der Riegel sass
 * inline, und derselbe Ausdruck an zwei Stellen ist eine zweite Wahrheit.
 * Diese Datei ist die eine.
 *
 * WARUM NICHT `lesbarerKontostand`. Das Prädikat ist dasselbe (endliche Zahl
 * grösser als 0), die SACHE ist es nicht: ein Prozentsatz ist kein
 * Kontostand, und dieselbe Funktion für beides zu benutzen wäre ein
 * Namensbruch, der beim nächsten Lesen Arbeit macht. Zwei kleine, ehrlich
 * benannte Lesarten sind besser als eine, die zwei Dinge heisst.
 *
 * EINE ZEICHENKETTE WIRD ABGEWIESEN, nicht gelesen. `"0.05"` ergab vorher
 * durch JS-Umwandlung eine Grösse — ein String in einem Zahlenfeld heisst
 * aber, dass der Aufrufer den falschen Typ schickt, und das zu übersetzen
 * verdeckt seinen Fehler. Bei einer Order ist ein 400 mit Grund besser als
 * eine Grösse auf Verdacht (Regel 14.11.).
 *
 * UND EIN FEHLENDER WERT IST KEIN STANDARD. Die `1.0` in der Route war eine
 * ZWEITE Quelle für den Standard-Risikosatz neben `maxRiskPerTradePct` in
 * den Einstellungen — und ein Aufrufer, der nicht sagt, wieviel er riskieren
 * will, soll keine stille Entscheidung bekommen. Gemessen, dass das keinen
 * echten Aufrufer bricht: einziger Aufrufer beider Order-Routen ist
 * `MarketScannerPanel.tsx:161`, und der sendet `riskPercent` immer.
 *
 * KEINE OBERGRENZE HIER. `1e6` bleibt eine endliche Zahl > 0 und wird von
 * `MAX_SIZE` in der Grössenrechnung geklemmt — dort gehört die Grenze hin.
 * Was ein "zu grosser" Prozentsatz ist, steht in den Einstellungen
 * (`maxRiskPerTradePct`), und der Orchestrator klemmt bereits dagegen. Eine
 * zweite, erfundene Obergrenze in dieser Datei wäre eine
 * Policy-Entscheidung an der falschen Stelle.
 */

/**
 * Einen rohen Risikosatz in Prozent lesen — oder `null`.
 *
 * Gültig ist ausschliesslich eine **endliche Zahl grösser als 0**. Ein
 * Risiko von 0 heisst "nicht handeln" und darf keine Mindest-Order
 * erzeugen; negativ, `NaN`, `±Infinity`, Zeichenketten, `null`, `undefined`
 * und Objekte sind unbrauchbar.
 */
export function lesbaresRisiko(roh: unknown): number | null {
  if (typeof roh !== "number") return null;
  if (!Number.isFinite(roh)) return null;
  if (roh <= 0) return null;
  return roh;
}

/**
 * WARUM er unbrauchbar ist — für die Fehlermeldung der Route.
 *
 * "ungültig" allein sagt dem Aufrufer nicht, ob er das Feld vergessen, eine
 * Zeichenkette geschickt oder eine 0 gesendet hat. Drei Lagen, drei
 * verschiedene nächste Schritte — die Regel "eine Diagnose darf im
 * interessanten Fall nicht schweigen".
 *
 * Gibt `null` zurück, wenn der Wert BRAUCHBAR ist, damit die Route beides
 * aus einer Quelle liest, ohne die Prüfung zu wiederholen.
 */
export function risikoGrund(roh: unknown): string | null {
  if (lesbaresRisiko(roh) !== null) return null;
  if (roh === undefined || roh === null) return "fehlt";
  if (typeof roh !== "number") return `keine Zahl (${typeof roh})`;
  if (Number.isNaN(roh)) return "NaN";
  if (!Number.isFinite(roh)) return "unendlich";
  if (roh === 0) return "0 — das hiesse nicht handeln";
  return "nicht grösser als 0";
}
