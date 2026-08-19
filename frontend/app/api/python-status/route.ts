export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPythonStatus, AUSFALL_AB_FEHLERN } from "@/lib/python-backend/python-status";

/**
 * Zustand des Python-Backends (19.08.).
 *
 * ANLASS. In der Generalkontrolle vom 18.08. fiel auf, dass der Dienst im
 * Hintergrund GAR NICHT überwacht wurde: `pyHealthCheck()` hatte keinen
 * Aufrufer, `/api/market-data/health` wird nur von `LiveMarketWidget.tsx`
 * geholt — also nur, solange jemand die Seite offen hat — und der
 * Diagnostics-Agent prüfte ausschliesslich Agenten. Fiel Python nachts aus,
 * erfuhr es niemand.
 *
 * Diese Route macht KEINEN Testaufruf beim Backend. Sie gibt zurück, was im
 * laufenden Betrieb ohnehin gezählt wurde — jeder echte Aufruf über `post()`
 * und `get()` in python-client.ts wird verbucht. Ein zusätzlicher Health-Ping
 * wäre Last ohne Erkenntnis: gehen die echten Aufrufe durch, ist der Dienst
 * erreichbar; gehen sie nicht durch, ist genau das die Antwort.
 *
 * erreichbar ist bewusst dreiwertig:
 *   true   antwortet
 *   false  fällt aus (mindestens AUSFALL_AB_FEHLERN Fehlschläge in Folge)
 *   null   seit dem Start nicht gerufen — ist PYTHON_BACKEND_URL nicht gesetzt,
 *          wird gar nicht erst gerufen, und das ist KEIN Ausfall
 *
 * Der Telegram-Alarm hängt NICHT an dieser Route, sondern am
 * Diagnostics-Agent, der alle fünf Minuten den Zustandswechsel prüft.
 */
export async function GET() {
  const status = getPythonStatus();
  return NextResponse.json({
    ok: true,
    ausfallAbFehlern: AUSFALL_AB_FEHLERN,
    hinweis: status.gesamt === 0
      ? "Seit dem Start wurde das Python-Backend nicht gerufen — ohne gesetzte "
        + "PYTHON_BACKEND_URL ist das normal."
      : status.erreichbar === false
        ? `Python-Backend fällt aus: ${status.fehlerInFolge} Fehlschläge in Folge `
          + `(zuletzt ${status.letzterFehler ?? "?"} bei ${status.letzterFehlerPfad ?? "?"}). `
          + `Der Handel läuft weiter, aber ohne die zweite Absicherungsschicht.`
        : `Python-Backend antwortet. Fehleranteil ${status.fehlerAnteilPct} %.`,
    status,
  });
}
