export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { generateExecutionQueuePositionSyncReport } from "../../../lib/execution-queue-position-sync";
import { isCapitalConnected, autoReconnectCapital, getLastReconnectError } from "../../../lib/capital-com/capital-com-session";

export async function GET() {
  // Fire reconnect in background — don't block the response
  if (!isCapitalConnected()) {
    autoReconnectCapital().catch(() => {});
  }

  const report = generateExecutionQueuePositionSyncReport();
  const capitalComActive = isCapitalConnected();

  // DER GRUND GEHOERT MIT (28.10.). Der Reconnect laeuft bewusst ohne
  // `await`, damit die Antwort nicht blockiert — sein Ergebnis ist damit
  // aber weg. `autoReconnectCapital()` legt den Fehler auf
  // `global.__capital_last_error__`; von dort liest ihn
  // `getLastReconnectError()`. Ohne diese Zeile sagte die Antwort nur
  // "nicht verbunden" und nie WARUM — "wer den Grund nicht mitschreibt,
  // muss ihn spaeter raten" (22.09.).
  //
  // Genau so macht es `/api/capital-com` schon seit jeher (Zeile 20, 47, 59);
  // diese Route war die einzige, die es nicht tat.
  return NextResponse.json({
    ok: true,
    report: { ...report, capitalComActive, reconnectError: getLastReconnectError() },
  });
}
