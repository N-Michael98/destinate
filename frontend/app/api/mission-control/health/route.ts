export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { MissionControlEventLog } from "@/lib/mission-control/event-log";
import { missionControlEndpointRegistry } from "@/lib/mission-control-endpoint-registry";

// Direct function imports — no HTTP self-fetch, no URL issues
import { getDependencyScannerReport } from "@/lib/dependency-scanner";
import { runPortfolioBrain } from "@/lib/portfolio-brain/brain-manager";
// 03.09.: `getBrokerHealthMonitorReport` aus @/lib/broker-health-monitor ist
// hier entfallen — der Broker-Zustand wird jetzt aus den echten Sitzungen
// abgeleitet. Damit haengt diese Route nicht mehr an einem Modul, das von
// keinem Handelspfad benutzt wird und dessen Route null Aufrufer hat.
import { marketDataManager } from "@/lib/market-data-engine";
import { buildOpportunityScannerReport } from "@/lib/market-universe/opportunity-scanner";
import { generateEvolutionGovernanceReport } from "@/lib/evolution-governance";
import { getLearningState } from "@/lib/learning/trade-feedback-engine";
// `TradeTicketBuilder` ist am 03.09. entfallen: er diente nur dazu, dem
// Gesundheits-Check ein erfundenes Ticket zu bauen, damit er bestand.
import { ExecutionQueue } from "@/lib/execution-preparation";
import { getAISettings } from "@/lib/ai-config";

type HealthStatus = "READY" | "WARNING" | "ERROR";

interface EndpointResult {
  key: string;
  label: string;
  endpoint: string;
  group: string;
  critical: boolean;
  description: string;
  status: HealthStatus;
  summary: string;
  responseTimeMs: number;
  checkedAt: string;
}

async function checkEndpoint(key: string, checkedAt: string): Promise<{ status: HealthStatus; summary: string }> {
  try {
    switch (key) {
      case "dependency": {
        const r = getDependencyScannerReport();
        return { status: "READY", summary: `${r.activeItems ?? 0}/${r.totalItems ?? 0} active` };
      }
      case "portfolio": {
        const r = runPortfolioBrain();
        return { status: "READY", summary: r.status ?? "READY" };
      }
      case "consensus": {
        return { status: "READY", summary: "Consensus Engine online" };
      }
      case "gptAnalyst": {
        const ai = await getAISettings();
        return { status: "READY", summary: ai.openai.connected ? `Connected (${ai.openai.model})` : "Simulation mode" };
      }
      case "claudeRisk": {
        const ai = await getAISettings();
        return { status: "READY", summary: ai.anthropic.connected ? `Connected (${ai.anthropic.model})` : "Simulation mode" };
      }
      // 03.09.: Hier stand
      //   const tickets = [TradeTicketBuilder.build("XAUUSD","BUY",3365,…,96,…)];
      //   return { status: "READY", summary: `${tickets.length} tickets` };
      // Der Gesundheits-Check baute sich sein eigenes Ticket und meldete dann
      // "1 tickets, READY". Er bestand also, weil er sich die Eingabe selbst
      // erfunden hatte. Jetzt wird die ECHTE Warteschlange gelesen — die ist
      // strukturell leer, weil `lib/execution-preparation` keinen Aufrufer im
      // Handelspfad hat (System-Karte, 03.09.). Genau das steht jetzt da.
      case "executionTickets":
      case "executionQueue": {
        const queue = ExecutionQueue.getAll();
        return {
          status: "READY",
          summary: `${queue.length} in der Warteschlange — kein Handelspfad füllt sie`,
        };
      }
      // 03.09.: Hier stand `getBrokerHealthMonitorReport()` aus
      // `lib/broker-health-monitor` — ein Modul mit fest verdrahteten Werten,
      // das von keinem Handelspfad benutzt wird und dessen Route null Aufrufer
      // hat. Die Kachel meldete daraus "N/M brokers healthy". Jetzt aus den
      // ECHTEN Sitzungen abgeleitet.
      case "brokerHealth": {
        const { brokerZustand } = await import("@/lib/broker-status/broker-status");
        const { getCapitalSession } = await import("@/lib/capital-com/capital-com-session");
        const { getICMarketsSession } = await import("@/lib/icmarkets/icmarkets-session");
        const z = brokerZustand(getCapitalSession(), getICMarketsSession());
        // Kein Broker verbunden heisst: der Handelszyklus ueberspringt jeden
        // Durchlauf. Das ist eine WARNUNG, kein READY.
        return {
          status: z.verbunden > 0 ? "READY" : "WARNING",
          summary: `${z.verbunden}/${z.gesamt} Broker verbunden`,
        };
      }
      // 26.08.: isReady() gab bedingungslos `true` zurück, die Kachel meldete
      // also immer "Online". Der dahinterliegende Preis-Cache hatte zudem
      // keinen einzigen Schreiber. Beides ist behoben — der Handelszyklus
      // legt seine Marktliste jetzt dort ab.
      //
      // Das Alter steht mit dabei: eine Zahl allein sagt nicht, ob der Zyklus
      // noch läuft. `getAll()` verwirft abgelaufene Einträge, ein stehender
      // Zyklus fällt also nach CACHE_MAX_ALTER_MS auf 0 zurück — die Kachel
      // wird dann von selbst gelb, ohne dass jemand hinschauen muss.
      case "marketData": {
        const anzahl = marketDataManager.cacheSize();
        const alter = marketDataManager.cacheAlterMinuten();
        return anzahl > 0
          ? {
              status: "READY",
              summary: `${anzahl} Preise im Cache, jüngster ${alter} Min alt`,
            }
          : {
              status: "WARNING",
              summary: "Cache leer — der Handelszyklus hat noch keine Kurse "
                + "abgelegt (oder sie sind abgelaufen)",
            };
      }
      case "marketRegime": {
        return { status: "READY", summary: "Market Regime online" };
      }
      case "opportunity": {
        const r = buildOpportunityScannerReport();
        return { status: "READY", summary: `${r.opportunities?.length ?? 0} opportunities` };
      }
      case "evolution": {
        const r = generateEvolutionGovernanceReport();
        return { status: "READY", summary: r.status ?? "READY" };
      }
      // ECHTER Lernzustand statt Mock (24.08.).
      //
      // Bis heute stand hier getLearningFeedbackIntegrationReport() — ein
      // Bericht aus fest eingebauten Fantasie-Trades (SPX500, pnlAmount 150).
      // Er gelang immer, also meldete die Kachel IMMER "READY". Eine
      // Gesundheitsprüfung, die nicht fehlschlagen kann, prüft nichts.
      //
      // Jetzt der Zustand des Lernsystems, das seit dem 24.08. stündlich aus
      // den ECHTEN geschlossenen Trades rechnet. getLearningState() ist ein
      // billiger Lesezugriff auf den Speicher — eine Gesundheitsprüfung darf
      // keinen vollen Zyklus auslösen.
      //
      // Die Kachel meldet WARNING, solange noch nie gelernt wurde. Das ist
      // kein Fehler, sondern der ehrliche Zustand "noch keine geschlossenen
      // Trades" — und genau das soll man sehen können.
      case "learning": {
        const s = getLearningState();
        const zyklen = s?.learningCycles ?? 0;
        const trades = s?.totalTradesAnalyzed ?? 0;
        const symbole = Object.keys(s?.symbolPerformance ?? {}).length;
        if (zyklen === 0) {
          return { status: "WARNING", summary: "noch kein Lernzyklus gelaufen" };
        }
        return {
          status: "READY",
          summary: `${zyklen} Zyklen, ${trades} Trades, ${symbole} Symbole`,
        };
      }
      default:
        return { status: "WARNING", summary: "Unknown endpoint" };
    }
  } catch (err) {
    return { status: "ERROR", summary: err instanceof Error ? err.message : "Internal error" };
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();

  const endpoints: EndpointResult[] = await Promise.all(
    missionControlEndpointRegistry.map(async (item) => {
      const start = Date.now();
      const { status, summary } = await checkEndpoint(item.key, checkedAt);
      return {
        key: item.key,
        label: item.label,
        endpoint: item.endpoint,
        group: item.group,
        critical: item.critical,
        description: item.description,
        status,
        summary,
        responseTimeMs: Date.now() - start,
        checkedAt,
      };
    })
  );

  const ready = endpoints.filter((e) => e.status === "READY").length;
  const warnings = endpoints.filter((e) => e.status === "WARNING").length;
  const errors = endpoints.filter((e) => e.status === "ERROR").length;
  const criticalErrors = endpoints.filter((e) => e.status === "ERROR" && e.critical).length;

  // Log events
  const existingEvents = MissionControlEventLog.getAll();
  for (const ep of endpoints) {
    if (ep.status === "ERROR" || ep.status === "WARNING") {
      MissionControlEventLog.addDeduped({
        type: `HEALTH_${ep.status}`,
        severity: ep.status === "ERROR" ? "CRITICAL" : "WARNING",
        source: ep.label,
        message: `${ep.endpoint} returned ${ep.status}. Summary: ${ep.summary}`,
        payload: ep,
      });
    } else if (ep.status === "READY") {
      const had = existingEvents.find(
        (e) => e.source === ep.label && (e.severity === "CRITICAL" || e.severity === "WARNING")
      );
      if (had) {
        MissionControlEventLog.addDeduped({
          type: "HEALTH_RECOVERY",
          severity: "INFO",
          source: ep.label,
          message: `${ep.endpoint} recovered and is READY again.`,
          payload: ep,
        });
      }
    }
  }

  return NextResponse.json({
    ok: criticalErrors === 0,
    version: "V15.B.14",
    checkedAt,
    totalEndpoints: endpoints.length,
    ready,
    warnings,
    errors,
    criticalErrors,
    healthScore: endpoints.length === 0 ? 0 : Math.round((ready / endpoints.length) * 100),
    endpoints,
  });
}
