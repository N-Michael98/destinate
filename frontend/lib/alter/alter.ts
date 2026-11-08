/**
 * Das Alter einer offenen Position in Stunden — oder `null` für **unbekannt**.
 *
 * EIGENES Modul, rein, ohne Importe und ohne Seiteneffekte — dieselbe
 * Begründung wie bei `htmlSicher` (31.10.) und `redisLageMelden` (01.11.):
 * einer der Nutzer (`risk-agent.ts`) steht auf der Liste der Dateien mit
 * erhöhtem Risiko, und dort gehört ein kleiner Diff hin.
 *
 * ## Warum gemeinsam und nicht zweimal
 *
 * Am 08.11. stand diese Regel an zwei Stellen, die dasselbe rechnen:
 * `alterStundenIC` (IC-Zeit-Exit, an diesem Tag von mir angelegt) und — ohne
 * den Zukunfts-Riegel — in `risk-agent.ts` (Capital-Zeit-Exit). Zwei Fassungen
 * desselben Rechenwegs können auseinanderlaufen, und dann entscheidet ein
 * Broker anders als der andere über denselben Sachverhalt.
 *
 * NICHT dasselbe und deshalb eigenständig:
 *  - `ageInMinutes` (`orchestrator-agent.ts`, 22.09.) rechnet in **Minuten**
 *    und misst das Alter eines KURSES, nicht einer Position.
 *  - `alterStunden` in `positionen-lage.ts` (07.11.) arbeitet auf einer
 *    ISO-Zeichenkette und verlangt eine **Zonenangabe**, weil sie für die
 *    ANZEIGE rechnet; eine zonenlose Broker-Zeit gilt dort als unbekannt.
 *  - `stundenSeit` (`broker-status.ts`) misst `connectedAt`, also **unsere
 *    eigene** Zeit — dort ist eine Zukunft nicht erreichbar (gemessen).
 *
 * ## Drei Lagen
 *
 *  - **Keine lesbare Zeit** (`NaN`, ±`Infinity`) → `null`.
 *    `new Date("Unsinn").getTime()` ist `NaN`, und `NaN >= maxHours` ist
 *    `false`: ohne `Number.isFinite` wäre der Zeit-Exit stumm aus. Fünfte
 *    Wiederholung derselben Falle (24.08., 28.10., 29.10., 03.11., 08.11.).
 *
 *  - **Zukunft bis 2 Minuten** → `0`. Echter Uhren-Versatz zwischen zwei
 *    Rechnern; dieselbe Schranke wie `ageInMinutes` (22.09.), damit die Grenze
 *    nicht je Broker eine andere ist.
 *
 *  - **Zukunft darüber** → `null`, also **unbekannt**. Zwei Folgen hingen
 *    daran, beide am 08.11. gemessen: der Zeit-Exit feuerte um den Versatz
 *    **verspätet**, und die Zahl ging als „Position offen seit **-1.5
 *    Stunden**" in den **KI-Prompt** des AI Managers (`risk-agent.ts:426`) —
 *    also an genau die Entscheidung über Breakeven, Teilgewinn und Trailing.
 *
 * ## Unbekannt heisst AUSGESETZT, nicht „geschlossen"
 *
 * Das ist die Entscheidung vom 19.08.: ohne bekannte Eröffnungszeit wird
 * NICHT geschlossen, denn ein Eingriff auf einer Annahme kostet echtes Geld.
 * Dafür wird es laut — der Aufrufer meldet den Grund, und die drei Lagen
 * führen zu drei verschiedenen nächsten Schritten.
 *
 * `jetztMs` ist injizierbar, damit der Prüfstand **rechnen** kann statt den
 * Wortlaut festzunageln.
 */
export function alterStunden(openedMs: number, jetztMs: number): number | null {
  if (!Number.isFinite(openedMs) || !Number.isFinite(jetztMs)) return null;
  const stunden = (jetztMs - openedMs) / 3_600_000;
  if (stunden >= 0) return stunden;
  return stunden >= -(2 / 60) ? 0 : null;
}

/**
 * Der Grund, warum ein Alter unbekannt ist — in Worten.
 *
 * Als eigene Funktion, weil „wer den Grund nicht mitschreibt, muss ihn später
 * raten" (22.09.) und die drei Lagen zu drei verschiedenen nächsten Schritten
 * führen: eine FEHLENDE Zeit ist ein Broker, der sie nicht liefert; eine
 * UNLESBARE ist ein Formatproblem; eine ZUKUNFT ist ein Zonen- oder
 * Uhrenproblem — und nur die letzte hat eine Ursache, die man suchen kann.
 *
 * Gibt `null` zurück, wenn das Alter bekannt ist (dann gibt es nichts zu
 * melden). Der Aufrufer hängt seinen broker-spezifischen Hinweis an.
 */
export function alterGrund(roh: string | null | undefined, openedMs: number,
                           jetztMs: number): string | null {
  const t = typeof roh === "string" ? roh.trim() : "";
  if (t === "") return "FEHLT";
  if (!Number.isFinite(openedMs)) return `ist unlesbar (${t})`;
  if (alterStunden(openedMs, jetztMs) === null) return `liegt in der ZUKUNFT (${t})`;
  return null;
}
