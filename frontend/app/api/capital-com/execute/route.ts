export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { executeCapitalDemoOrder, type ExecutionRequest } from "../../../../lib/capital-com/capital-com-execution";
import { isCapitalConnected } from "../../../../lib/capital-com/capital-com-session";
import { lesbareRichtung } from "../../../../lib/richtung/richtung";

export async function POST(request: Request) {
  try {
    if (!isCapitalConnected()) {
      return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<ExecutionRequest>;

    if (!body.symbol || !body.direction || !body.accountBalance) {
      return NextResponse.json({ ok: false, error: "symbol, direction und accountBalance erforderlich" }, { status: 400 });
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
      riskPercent: body.riskPercent ?? 1.0,
      accountBalance: body.accountBalance,
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
