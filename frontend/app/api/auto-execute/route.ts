export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSettings } from "../../../lib/settings/settings-store";
import { isCapitalConnected, getCapitalSession } from "../../../lib/capital-com/capital-com-session";
import { cacheGet } from "../../../lib/cache/redis-cache";

type TradingStyle = "DAYTRADING" | "SCALPING" | "SWING";
declare global {
  var __daily_trades__: { date: string; count: number; byStyle: Record<string, number> } | undefined;
  // BLEIBT HIER, obwohl diese Route sie selbst nicht mehr benutzt (07.09.).
  // Beim Ausbau der Ausführung zuerst mitentfernt — daraufhin meldete tsc
  // fünf Fehler in VIER anderen Dateien (execution-status/route.ts,
  // market-scanner/route.ts zweimal, orchestrator-agent.ts zweimal): sie alle
  // lesen `global.__last_scan_result__` und bekamen ihren Typ von hier.
  // Eine projektweite Typdeklaration in einer API-Route ist zerbrechlich, aber
  // das Verschieben ist eine eigene Änderung und gehört nicht in diesen Commit.
  var __last_scan_result__: { opportunities: unknown[]; updatedAt: string } | undefined;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

/**
 * Der Tageszähler wird hier NUR GELESEN, nie angelegt (07.09.).
 *
 * DER FUND. Hier stand `ensureDailyTrades()`:
 *
 *     if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
 *       global.__daily_trades__ = { date: today, count: 0, byStyle: {} };
 *     }
 *
 * — aufgerufen aus dem GET, also aus einem reinen Statusbericht. Ein Lesepfad,
 * der gemeinsamen Zustand SCHREIBT.
 *
 * Das war nicht harmlos. Der Orchestrator stellt den Zähler nach einem
 * Neustart aus Redis wieder her, aber nur unter einer Bedingung
 * (orchestrator-agent.ts:511):
 *
 *     if (!global.__daily_trades__ || global.__daily_trades__.date !== today) {
 *       global.__daily_trades__ = { date: today, count: redisDailyRaw?.count ?? 0, … };
 *     }
 *
 * Wer den Zähler zuerst anlegt, gewinnt. Und das war regelmässig dieser GET:
 * MarketScannerPanel.tsx ruft ihn bei eingeschaltetem Auto-Scan alle 60
 * Sekunden auf, der Orchestrator läuft alle 5 Minuten. Nach jedem Deploy mit
 * geöffnetem Dashboard stand also `count: 0` im Speicher, der Orchestrator sah
 * einen vorhandenen Eintrag mit heutigem Datum und übersprang die
 * Wiederherstellung aus Redis — die bereits gehandelten Trades des Tages waren
 * vergessen und `maxTradesPerDay` begann von vorn.
 *
 * Redeploys sind in diesem Projekt Routine (der Railway-Snapshot-Fehler wird
 * mit einem leeren Commit behoben). Der Fall ist also nicht theoretisch.
 *
 * Deshalb: kein Schreiben. Passt das Datum nicht, wird REDIS gefragt — dieselbe
 * Quelle, aus der auch der Orchestrator wiederherstellt. Der Bericht bleibt
 * damit ehrlich, ohne den Zustand zu berühren, den der Handelszyklus besitzt.
 */
async function tagesZaehler(): Promise<{ count: number; byStyle: Record<string, number> }> {
  const today = todayStr();
  const d = global.__daily_trades__;
  if (d && d.date === today) return { count: d.count, byStyle: d.byStyle };
  const ausRedis = await cacheGet<{ count: number; byStyle: Record<string, number> }>(
    `daily_trades:${today}`
  ).catch(() => null);
  return { count: ausRedis?.count ?? 0, byStyle: ausRedis?.byStyle ?? {} };
}

/**
 * STILLGELEGT (07.09.) — dieser Pfad hat Orders ausgeführt, ohne die Riegel
 * des Orchestrators zu haben.
 *
 * Er war ein ZWEITER Ausführungsweg neben `runOrchestratorCycle()`, und die
 * beiden waren nicht gleich abgesichert. Nebeneinandergelegt:
 *
 *   Riegel                        Orchestrator      POST hier
 *   Killswitch                    ja                NEIN
 *   Handelszeitfenster            ja                NEIN
 *   Filterkette (neun Stufen)     ja                NEIN
 *   Vola-Skalierung des Risikos   ja                NEIN
 *   Schwelle auf >= 70 geklemmt   ja                NEIN (roh, Standard 80)
 *   minConfidence                 via max()         eigener Riegel, Standard 65
 *   Gelegenheiten                 selbst gescannt   AUS DEM REQUEST-BODY
 *   Tageszähler nach Redis        ja                nein (nur im Speicher)
 *
 * Die vorletzte Zeile war die schlimmste: `body.opportunities` wurde ungeprüft
 * übernommen (`opportunities = body.opportunities as …`). Ein Aufruf konnte
 * damit `goSignal: true`, eine beliebige Confidence, ein beliebiges Symbol und
 * beliebige Stop-/Ziel-Preise mitliefern — vorbei an der Analyse-Engine und an
 * der gesamten Filterkette. Das ist kein Randfall der Logik, das ist das
 * Umgehen aller neun Stufen.
 *
 * NACHGEMESSEN, NICHT VERMUTET:
 *  - Kein einziger Aufrufer im ganzen Repo schickt hier ein POST. Gesucht wurde
 *    in frontend/, backend/ und analysis-engine/, unter Ausschluss von
 *    node_modules, .next und tsconfig.tsbuildinfo — letzteres enthält jeden
 *    Dateipfad und hat in dieser Sitzung schon zweimal eine tote Route
 *    "benutzt" aussehen lassen. Übrig bleibt genau ein Treffer, und der ist ein
 *    GET: MarketScannerPanel.tsx:138 holt den Statusbericht.
 *  - Der manuelle GO-Knopf läuft NICHT hierüber. Der Kommentar direkt darüber
 *    in MarketScannerPanel.tsx sagt es wörtlich: "Manueller GO-Button bleibt
 *    aktiv via /api/capital-com/execute". Es geht keine Bedienmöglichkeit
 *    verloren.
 *  - Die Route hatte den Übergang schon halb vollzogen: sie lehnte alles ohne
 *    `manual: true` ab, mit der Begründung "OrchestratorAgent übernimmt
 *    automatische Ausführung". `manual: true` war der Rest der Rampe.
 *
 * BEWUSST NICHT NACHGERÜSTET statt stillgelegt: die fehlenden Riegel hier
 * nachzubauen hiesse, dieselbe Entscheidung ein zweites Mal zu schreiben —
 * genau die Fehlerklasse, an der dieses Programm wiederholt gelitten hat (eine
 * Zahl an zwei Stellen, ein Riegel in zwei Fassungen). Wird ein manueller
 * Auslöser gewünscht, gehört er auf den Pfad des Orchestrators, nicht daneben.
 *
 * Der ausgebaute Rumpf ist NICHT auskommentiert stehen geblieben: toter Code,
 * der aussieht wie lebender, ist die nächste Falle. Er steht vollständig in der
 * Versionsgeschichte.
 *
 * GET bleibt erhalten — er wird benutzt und führt nichts aus.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { opportunities?: unknown[]; manual?: boolean };
    console.warn(
      "[auto-execute] POST abgelehnt — dieser Ausführungsweg ist stillgelegt "
      + `(manual=${String(body.manual)}, opportunities=${
        Array.isArray(body.opportunities) ? body.opportunities.length : 0})`
    );
    return NextResponse.json({
      ok: false,
      executed: false,
      reason: "Dieser Ausführungsweg ist stillgelegt (07.09.). Er hatte weder "
        + "Killswitch noch Handelszeitfenster, Filterkette oder Vola-Skalierung "
        + "und übernahm Gelegenheiten ungeprüft aus dem Request-Body. "
        + "Automatische Ausführung: OrchestratorAgent. Manueller GO-Knopf: "
        + "/api/capital-com/execute.",
    }, { status: 410 });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}

// GET — Statusbericht. Führt nichts aus und schreibt nichts.
export async function GET() {
  const settings = await getSettings();
  const session = getCapitalSession();
  const zaehler = await tagesZaehler();
  const proStil = (s: TradingStyle) => zaehler.byStyle[s] ?? 0;
  return NextResponse.json({
    ok: true,
    botMode: settings.botSettings.mode,
    autoApproveThreshold: settings.botSettings.autoApproveThreshold,
    maxTradesPerDay: settings.botSettings.maxTradesPerDay,
    maxConcurrentPositions: settings.botSettings.maxConcurrentPositions,
    dailyTradesUsed: zaehler.count,
    dailyTradesByStyle: {
      DAYTRADING: proStil("DAYTRADING"),
      SCALPING: proStil("SCALPING"),
      SWING: proStil("SWING"),
    },
    capitalConnected: isCapitalConnected(),
    accountBalance: session?.balance ?? null,
    currency: session?.currency ?? null,
    // Damit an der Oberfläche sichtbar ist, dass hier nicht mehr ausgeführt wird.
    postAusfuehrung: "stillgelegt",
  });
}
