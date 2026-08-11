export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getAIManagerStatus, AUSFALL_AB_FEHLERN } from "@/lib/agents/ai-manager-status";

/**
 * Zustand des Exit-AI-Managers (10.08.).
 *
 * ANLASS. /api/ai-health beweist, dass der Anbieter ERREICHBAR ist — es macht
 * dafür einen eigenen Testaufruf. Es sagt aber nichts darüber, was der AI
 * Manager im Handelsbetrieb tatsächlich getan hat: wie oft er zugestimmt,
 * übersprungen, angepasst hat, und wie oft er still auf den Regelwert
 * zurückgefallen ist. Genau das war unsichtbar — ein Ausfall erzeugte eine
 * console.warn-Zeile und sonst nichts.
 *
 * Diese Route macht KEINEN Aufruf beim Anbieter. Sie gibt zurück, was im
 * laufenden Betrieb gezählt wurde. Beides zusammen beantwortet die Frage
 * vollständig: /api/ai-health = "kann er antworten", diese Route = "hat er".
 *
 * erreichbar ist bewusst dreiwertig:
 *   true   antwortet
 *   false  fällt aus (mindestens AUSFALL_AB_FEHLERN Fehlschläge in Folge)
 *   null   seit dem Start noch nicht gefragt — ohne offene Position wird der
 *          Manager gar nicht gerufen, das ist KEIN Ausfall
 */
export async function GET() {
  const status = getAIManagerStatus();
  return NextResponse.json({
    ok: true,
    ausfallAbFehlern: AUSFALL_AB_FEHLERN,
    hinweis: status.gesamt === 0
      ? "Seit dem Start wurde noch keine Entscheidung angefragt — das ist ohne offene Position normal."
      : status.erreichbar === false
        ? `AI Manager fällt aus: ${status.fehlerInFolge} Fehlschläge in Folge. Das System handelt aktuell rein regelbasiert.`
        : `AI Manager antwortet. Fallback-Anteil ${status.fallbackAnteilPct} %.`,
    status,
  });
}
