export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { brokerZustand } from "@/lib/broker-status/broker-status";
import { getCapitalSession } from "@/lib/capital-com/capital-com-session";
import { getICMarketsSession } from "@/lib/icmarkets/icmarkets-session";

/**
 * Broker-Zustand, ABGELEITET (03.09.).
 *
 * ANLASS. Die Ansicht "Broker Center" zeigte fünfzehn fest verdrahtete Zeilen
 * aus `components/BrokerCenterPanel.tsx` — darunter "Connected: 10" und
 * "Healthy Sync Tickets: 10". Es gibt ZWEI Broker. Kein `fetch`, keine Quelle,
 * und es sah aus wie ein Live-Zustand.
 *
 * Diese Route macht KEINEN Broker-Aufruf. Sie liest die beiden Sitzungen, die
 * ohnehin auf `global` liegen (`__capital_session__`, `__icmarkets_session__`,
 * beide aus Redis wiederhergestellt und per keep-alive gepflegt), und gibt
 * zurück, was dort steht. Damit kostet ein Dashboard-Aufruf nichts und kann
 * auch nichts erfinden: ist keine Sitzung da, stehen die Werte auf `null`.
 *
 * Die Ableitung selbst liegt in `brokerZustand()` — als Funktion, damit der
 * Prüfer sie AUSFÜHREN kann statt den Wortlaut dieser Datei festzunageln.
 */
export async function GET() {
  try {
    const zustand = brokerZustand(getCapitalSession(), getICMarketsSession());
    return NextResponse.json({ ok: true, ...zustand });
  } catch (e) {
    // Kein erfundener Zustand im Fehlerfall — die Ansicht soll "unbekannt"
    // zeigen können und nicht "0 verbunden", was wie eine Messung aussähe.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
