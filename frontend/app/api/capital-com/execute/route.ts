export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { executeCapitalDemoOrder, type ExecutionRequest } from "../../../../lib/capital-com/capital-com-execution";
import { isCapitalConnected } from "../../../../lib/capital-com/capital-com-session";
import { lesbareRichtung } from "../../../../lib/richtung/richtung";
import { lesbarerKontostand, kontostandGrund } from "../../../../lib/kontostand/kontostand";
import { lesbaresRisiko, risikoGrund } from "../../../../lib/risiko/risiko";

export async function POST(request: Request) {
  try {
    if (!isCapitalConnected()) {
      return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ExecutionRequest>;

    if (!body.symbol || !body.direction) {
      return NextResponse.json({ ok: false, error: "symbol und direction erforderlich" }, { status: 400 });
    }

    // ── EINE LESART FUER DEN KONTOSTAND (14.11.) ─────────────────────────
    //
    // Hier stand `!body.accountBalance` im gemeinsamen Riegel. Das faengt
    // `undefined`, `0` und `NaN` — aber NICHT:
    //
    //   * negativ  (`!(-500)` ist falsch)   → Groesse auf MIN_SIZE geklemmt
    //   * Infinity (`!Infinity` ist falsch) → von MAX_SIZE geklemmt
    //   * "abc"    (`!"abc"` ist falsch)    → `"abc" * x` = NaN → Groesse NaN
    //
    // Der `as Partial<ExecutionRequest>`-Cast darueber prueft nichts, und
    // `tsc` sagt deshalb zu keinem dieser Werte etwas. Diese Route war damit
    // NICHT der Goldstandard, fuer den ich sie gehalten hatte — beide
    // Order-Routen bekommen dieselbe Lesart, sonst ist die Asymmetrie nur
    // verschoben statt behoben (Lehre 25.10.).
    const kontostand = lesbarerKontostand(body.accountBalance);
    if (kontostand === null) {
      return NextResponse.json({
        ok: false,
        error: `accountBalance unbrauchbar (${kontostandGrund(body.accountBalance)}) `
          + `— ohne Kontostand keine Positionsgroesse`,
      }, { status: 400 });
    }

    // ── EINE LESART FUER DEN RISIKOSATZ (15.11.) ─────────────────────────
    //
    // Hier stand `body.riskPercent ?? 1.0`. Zwei Fehler in einer Zeile:
    //
    // 1. `??` faengt `null`/`undefined` — und sonst nichts. Gemessen durch
    //    die echte `executeCapitalDemoOrder` gegen einen gezaehlten
    //    `capitalPlaceOrder`: `NaN` und `"abc"` ergaben eine Groesse von
    //    NaN AN DEN BROKER (mit `ok: true`), `Infinity` und `1e6` die
    //    GROESSTE erlaubte Position, `0` und negativ eine Mindest-Order.
    //    Seit dem 15.11. haelt `calcPositionSize` das ab — aber ein 400 mit
    //    Grund an der Grenze ist besser als ein Abbruch zwei Schichten
    //    weiter innen, weil nur hier der Aufrufer erfaehrt, WAS er falsch
    //    geschickt hat.
    //
    // 2. Die `1.0` war eine ZWEITE Quelle fuer den Standard-Risikosatz
    //    neben `maxRiskPerTradePct` in den Einstellungen. Ein Aufrufer, der
    //    nicht sagt, wieviel er riskieren will, bekommt jetzt keine stille
    //    Entscheidung mehr. Gemessen, dass das keinen echten Aufrufer
    //    bricht: einziger Aufrufer beider Order-Routen ist
    //    `MarketScannerPanel.tsx:161`, und der sendet `riskPercent` immer.
    const risiko = lesbaresRisiko(body.riskPercent);
    if (risiko === null) {
      return NextResponse.json({
        ok: false,
        error: `riskPercent unbrauchbar (${risikoGrund(body.riskPercent)}) `
          + `— ohne Risikosatz keine Positionsgroesse`,
      }, { status: 400 });
    }

    // ── Der Cast prueft NICHTS (08.11.) ──────────────────────────────────────
    //
    // `request.json()` ist `any`, und `as Partial<ExecutionRequest>` behauptet
    // einen Typ, den niemand nachsieht — `tsc` schweigt dazu, weil genau das
    // die Aufgabe eines Casts ist. `!body.direction` wies bisher nur leere
    // Werte ab: `{"direction":"LONG"}` kam DURCH, und weiter innen ist
    // `req.direction === "BUY"` dann `false` — die Order waere als SELL
    // gerechnet und "LONG" zusaetzlich ins Journal geschrieben.
    //
    // Wortgleiche Fehlerklasse wie `PATCH /api/trades/[id]` am 04.11.
    // (`c0e0f49`): ein Cast, der auf ungeprueften Eingaben luegt. Der Fix
    // dort deckte die LESER und den PATCH — diese Route nicht.
    //
    // GEMESSEN, nicht vermutet: der automatische Pfad ist davon NICHT
    // betroffen. `GPTMarketAnalysis.direction` ist `"BUY" | "SELL" | "WAIT"`
    // (getypt) und `goSignal` verlangt `!== "WAIT"` — dort ist die Richtung
    // beweisbar BUY/SELL. Untrusted ist allein diese Grenze hier.
    //
    // `lesbareRichtung` statt einer eigenen Pruefung: EINE Lesart im ganzen
    // Programm (Regel 03.11.), die kennt BUY/SELL und LONG/SHORT. Alles
    // andere wird ABGEWIESEN und nicht geraten — bei einer Order ist ein
    // 400 mit Grund immer besser als eine Richtung auf Verdacht.
    const richtung = lesbareRichtung(body.direction);
    if (!richtung) {
      return NextResponse.json({
        ok: false,
        error: "direction unlesbar — erlaubt sind BUY, SELL, LONG, SHORT",
      }, { status: 400 });
    }

    const req: ExecutionRequest = {
      symbol: body.symbol,
      direction: richtung,
      riskPercent: risiko,
      accountBalance: kontostand,
      stopLossPrice: body.stopLossPrice,
      takeProfitPrice: body.takeProfitPrice,
      stopLossPips: body.stopLossPips,
      takeProfitPips: body.takeProfitPips,
      confidence: body.confidence ?? 70,
      strategy: body.strategy ?? "UNKNOWN",
      tradingStyle: body.tradingStyle ?? "DAYTRADING",
    };

    const result = await executeCapitalDemoOrder(req);

    // Save to Trading Journal on success
    if (result.ok && result.dealId) {
      try {
        const { saveCapitalTradeToJournal } = await import("../../../../lib/capital-com/capital-trade-tracker");
        await saveCapitalTradeToJournal({
          // Unbestaetigte Order mitschreiben (17.08.) — sonst ist ein
          // Phantom-Trade spaeter nicht von einem echten Nulltrade zu trennen.
          unbestaetigt: result?.unbestaetigt,
          dealId: result.dealId,
          symbol: req.symbol,
          direction: req.direction,
          tradingStyle: req.tradingStyle,
          strategy: req.strategy,
          entry: result.openLevel ?? (body as { entryPrice?: number }).entryPrice ?? 0,
          stopLoss: req.stopLossPrice ?? 0,
          takeProfit: req.takeProfitPrice ?? 0,
          size: result.size,
          accountBalance: req.accountBalance,
          riskPercent: req.riskPercent,
          confidence: req.confidence,
          // Auch der manuelle Weg schreibt die Quelle mit (30.10.) —
          // sonst waere die Messung nur halb. Fehlt sie, bleibt das
          // Feld leer statt geraten.
          signalQuelle: typeof (body as { signalQuelle?: unknown }).signalQuelle === "string"
            ? (body as { signalQuelle?: string }).signalQuelle : undefined,
        });
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
