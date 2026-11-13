export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { clearICMarketsSession } from "@/lib/icmarkets/icmarkets-session";
import { updateBrokerConnection } from "@/lib/settings/settings-store";

export async function POST() {
  await clearICMarketsSession();
  // Der `catch` bleibt: `clearICMarketsSession()` ist schon gelaufen, das
  // ist die eigentliche Arbeit der Route. Der Grund darf aber nicht
  // verschwinden (12.11.).
  //
  // Er geht ins KONSOLEN-Log, NICHT in die Antwort — nachgezaehlt: die
  // Route hat genau einen Aufrufer, `SettingsDashboard.tsx:448`, und der
  // lautet `fetch(...).catch(() => {})`. Er liest die Antwort nie. Ein
  // Grund in `message` waere ein stummes Feld (Klasse 28.10.).
  await updateBrokerConnection({ brokerKey: "IC_MARKETS", connected: false, error: null })
    .catch((e: unknown) => console.error(
      `[icmarkets-disconnect] Verbindungsstand NICHT gespeichert: `
      + `${e instanceof Error ? e.message : String(e)} — die Sitzung IST `
      + `getrennt, aber die Anzeige kann IC weiter als verbunden fuehren.`));
  return NextResponse.json({ ok: true, message: "IC Markets getrennt und Session aus Redis gelöscht." });
}
