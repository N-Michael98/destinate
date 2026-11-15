export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { executeICMarketsOrder } from "../../../../lib/icmarkets/icmarkets-execution";
import { isICMarketsConnected, getICMarketsSession } from "../../../../lib/icmarkets/icmarkets-session";
import { lesbareRichtung } from "../../../../lib/richtung/richtung";
import { lesbarerKontostand, kontostandGrund } from "../../../../lib/kontostand/kontostand";
import { lesbaresRisiko, risikoGrund } from "../../../../lib/risiko/risiko";
import { getSettings } from "../../../../lib/settings/settings-store";

export async function POST(request: Request) {
  try {
    // ── AUSFUEHRUNG AUF IC MUSS FREIGEGEBEN SEIN (14.11.) ────────────────
    //
    // Gemessen, nicht vermutet: `icMarketsExecutionEnabled` wurde an ZWEI
    // Stellen geprueft — `execution-agent.ts:266` und
    // `orchestrator-agent.ts:1177` — in dieser Route NICHT.
    // `MarketScannerPanel.tsx:175` ruft sie aber zusammen mit der
    // Capital-Route BEDINGUNGSLOS in einem `Promise.all`: der GO-Knopf
    // platzierte damit eine IC-Order, egal wie der Schalter stand. Was heute
    // schuetzte, war allein `isICMarketsConnected()` — eine leere Sitzung,
    // kein Riegel.
    //
    // Der Grund steht in `execution-agent.ts:255`: IC ist der UNGESCHUETZTE
    // Pfad. Eigener Kontostand (dort gemessen 12.7x), und KEINE der sieben
    // Schutzschichten sieht dieses Konto.
    //
    // FAIL CLOSED, aber HOERBAR: laesst sich die Einstellung nicht lesen,
    // bleibt IC gesperrt — mit EIGENEM Grund, damit "abgeschaltet" von
    // "nicht lesbar" zu unterscheiden ist. Ein stilles Gleichsetzen waere
    // die Fehlerklasse vom 22.09.
    const einstellungen = await getSettings().catch(() => null);
    if (einstellungen === null) {
      return NextResponse.json({
        ok: false,
        error: "Einstellungen nicht lesbar — IC-Ausfuehrung bleibt gesperrt",
      }, { status: 503 });
    }
    if (einstellungen.botSettings?.icMarketsExecutionEnabled !== true) {
      return NextResponse.json({
        ok: false,
        error: "IC-Markets-Ausfuehrung ist abgeschaltet "
          + "(Einstellungen → IC-Markets-Ausfuehrung)",
      }, { status: 403 });
    }

    if (!isICMarketsConnected()) {
      return NextResponse.json({ ok: false, error: "IC Markets nicht verbunden" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      symbol?: string;
      direction?: "BUY" | "SELL";
      riskPercent?: number;
      accountBalance?: number;
      stopLossPrice?: number;
      takeProfitPrice?: number;
      confidence?: number;
      tradingStyle?: string;
    };

    if (!body.symbol || !body.direction) {
      return NextResponse.json({ ok: false, error: "symbol und direction erforderlich" }, { status: 400 });
    }

    // Derselbe Riegel wie in `/api/capital-com/execute` — die Begruendung
    // steht dort ausfuehrlich. Kurz: der `as`-Cast auf `request.json()`
    // prueft nichts, `{"direction":"LONG"}` kam durch, und weiter innen ist
    // `req.direction === "BUY"` dann `false` (als SELL gerechnet) waehrend
    // `tradeSide: "LONG"` an den Broker gegangen waere.
    //
    // Beide Routen auf einmal, weil ein Fix an EINER Stelle die Frage nicht
    // beantwortet, wo die Klasse sonst noch steckt (Lehre 25.10.).
    const richtung = lesbareRichtung(body.direction);
    if (!richtung) {
      return NextResponse.json({
        ok: false,
        error: "direction unlesbar — erlaubt sind BUY, SELL, LONG, SHORT",
      }, { status: 400 });
    }

    // ── KEIN ERFUNDENER KONTOSTAND (14.11.) ──────────────────────────────
    //
    // Hier stand `body.accountBalance ?? session?.balance ?? 10000`. Zwei
    // Fehler in einer Zeile:
    //
    // 1. Die ERFINDUNG. 10000 an einer Stelle, die ueber die
    //    POSITIONSGROESSE entscheidet (`calcICPositionSize`), macht aus
    //    "unbekannt" eine Messung — die Fehlerklasse vom 07.09.
    // 2. `??` faengt `null`/`undefined`, aber NICHT `0` und NICHT `NaN`.
    //    `MarketScannerPanel` liest `Number(e.target.value)`, und
    //    `Number("")` ist 0: ein geleertes Eingabefeld lief hier durch bis
    //    `Math.max(snapped, step)` = MIN_UNITS, also eine Order mit der
    //    Mindestgroesse — waehrend Capital DIESELBE Nachricht mit 400 abwies.
    //
    // `lesbarerKontostand` ist EINE Lesart fuer beide Order-Routen; die
    // ausfuehrliche Begruendung steht im Modul. Die Reihenfolge bleibt wie
    // bisher: Anfrage zuerst, dann der Sitzungsstand.
    const session = getICMarketsSession();
    const kontostand = lesbarerKontostand(body.accountBalance)
      ?? lesbarerKontostand(session?.balance);
    if (kontostand === null) {
      return NextResponse.json({
        ok: false,
        error: `accountBalance unbrauchbar (${kontostandGrund(body.accountBalance)}) `
          + `und der Sitzungsstand ebenso (${kontostandGrund(session?.balance)}) `
          + `— ohne Kontostand keine Positionsgroesse`,
      }, { status: 400 });
    }

    // ── EINE LESART FUER DEN RISIKOSATZ (15.11.) ─────────────────────────
    // Dieselbe Lesart und dieselbe Antwort wie in
    // `/api/capital-com/execute` — die Begruendung steht dort ausfuehrlich.
    // Beide Routen auf einmal, weil ein Fix an EINER Stelle die Frage nicht
    // beantwortet, wo die Klasse sonst noch steckt (Lehre 25.10.).
    const risiko = lesbaresRisiko(body.riskPercent);
    if (risiko === null) {
      return NextResponse.json({
        ok: false,
        error: `riskPercent unbrauchbar (${risikoGrund(body.riskPercent)}) `
          + `— ohne Risikosatz keine Positionsgroesse`,
      }, { status: 400 });
    }

    const result = await executeICMarketsOrder({
      symbol: body.symbol,
      direction: richtung,
      riskPercent: risiko,
      accountBalance: kontostand,
      stopLossPrice: body.stopLossPrice,
      takeProfitPrice: body.takeProfitPrice,
      confidence: body.confidence ?? 70,
      tradingStyle: body.tradingStyle ?? "DAYTRADING",
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Fehler" }, { status: 500 });
  }
}
