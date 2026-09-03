export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { ausfuehrungsStand } from "@/lib/execution-status/execution-status";

/**
 * Ausführungs-Stand, ABGELEITET (03.09.).
 *
 * ANLASS. Die Ansicht "Execution Center" zeigte fünfzehn fest verdrahtete
 * Zeilen aus `components/ExecutionCenterPanel.tsx` ("Queue Tickets: 11",
 * "Execution Ready: 10/11"), dazu "Execution Status: Prepared" in Grün und
 * "Engine: Online". Am schwersten wog `/api/execution/tickets`: dort wurden
 * Handels-Tickets INLINE gebaut — XAUUSD BUY @ 3365, SL 3345, TP 3390/3420,
 * Confidence 96 — und die Ansicht schrieb darunter "Daten aus
 * /api/execution/tickets. Auto-Refresh alle 20 Sekunden."
 *
 * Diese Route erfindet nichts. Sie liest zwei Zustände, die der Handelszyklus
 * ohnehin führt — `global.__daily_trades__` (Redis-gestützt) und
 * `global.__last_scan_result__` — und die Grenzen aus den Einstellungen. Fehlt
 * ein Zähler, steht `null`, nicht 0.
 *
 * Die Ableitung liegt in `ausfuehrungsStand()`, damit der Prüfer sie AUSFÜHREN
 * kann statt den Wortlaut dieser Datei festzunageln.
 */
export async function GET() {
  try {
    const { getSettings } = await import("@/lib/settings/settings-store");
    const settings = await getSettings();
    const stand = ausfuehrungsStand(
      global.__daily_trades__,
      global.__last_scan_result__,
      {
        maxTradesPerDay: settings.botSettings?.maxTradesPerDay ?? null,
        tradeLimitEnabled: settings.botSettings?.tradeLimitEnabled ?? null,
        maxTradesPerDayByStyle: settings.botSettings?.maxTradesPerDayByStyle ?? null,
      },
    );
    return NextResponse.json({ ok: true, ...stand });
  } catch (e) {
    // Kein erfundener Stand im Fehlerfall — die Ansicht soll "unbekannt"
    // zeigen können und nicht "0 Trades heute", was wie eine Messung aussähe.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
