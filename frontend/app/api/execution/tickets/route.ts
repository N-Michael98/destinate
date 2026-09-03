export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { ExecutionQueue } from "../../../../lib/execution-preparation";

/**
 * Ausführungs-Tickets — KEINE erfundenen mehr (03.09.).
 *
 * WAS HIER STAND. Diese Route BAUTE die Tickets inline zusammen:
 *
 *   TradeTicketBuilder.build("XAUUSD", "BUY", 3365, 3345, 3390, 3420, 96,
 *                            true, "Consensus BUY")
 *   TradeTicketBuilder.build("USOIL",  "SELL", 78.40, 79.20, 77.00, 75.50, …)
 *   …
 *
 * Einstieg, Stop, zwei Ziele und "Confidence 96" — frei erfunden. Ausgeliefert
 * an die Ansicht "Execution Center", die darunter schrieb: "Daten aus
 * /api/execution/tickets. Auto-Refresh alle 20 Sekunden." Das sah aus wie ein
 * Live-Handelssignal. Dieselbe Fehlerklasse wie die erfundenen Empfehlungen
 * unter /market-intelligence und wie "Status: Prepared" bei einer Ansicht, die
 * es nie gab.
 *
 * Ausgeliefert wird jetzt die ECHTE Warteschlange. Nachgeprüft über die
 * System-Karte: `lib/execution-preparation` wird von KEINEM Handelspfad
 * erreicht — `ExecutionQueue.add()` hat genau einen Aufrufer, und der ist selbst
 * nur über API-Routen erreichbar. Die Liste ist deshalb strukturell immer leer,
 * und genau das sagt `hinweis`. Die echte Ausführung läuft über
 * `capital-com-execution.ts`; die echten Zahlen dazu stehen unter
 * `/api/execution-status`.
 */
export async function GET() {
  const tickets = ExecutionQueue.getAll();

  return NextResponse.json({
    success: true,
    tickets,
    count: tickets.length,
    hinweis:
      "Diese Warteschlange wird von keinem Handelspfad gefüllt und ist deshalb "
      + "immer leer. Die echte Ausführung läuft über capital-com-execution.ts; "
      + "die gemessenen Zahlen stehen unter /api/execution-status.",
    updatedAt: new Date().toISOString(),
  });
}
