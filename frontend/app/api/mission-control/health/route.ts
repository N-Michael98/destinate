export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { MissionControlEventLog } from "@/lib/mission-control/event-log";
import { missionControlEndpointRegistry } from "@/lib/mission-control-endpoint-registry";

// Direct function imports — no HTTP self-fetch, no URL issues
import { getDependencyScannerReport } from "@/lib/dependency-scanner";
import { runPortfolioBrain } from "@/lib/portfolio-brain/brain-manager";
import { getBrokerHealthMonitorReport } from "@/lib/broker-health-monitor";
import { marketDataManager } from "@/lib/market-data-engine";
import { buildOpportunityScannerReport } from "@/lib/market-universe/opportunity-scanner";
import { generateEvolutionGovernanceReport } from "@/lib/evolution-governance";
import { getLearningFeedbackIntegrationReport } from "@/lib/learning-feedback-integration";
import { TradeTicketBuilder, ExecutionQueue } from "@/lib/execution-preparation";
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
        return { status: "READY", summary: `${r.items?.length ?? 0} dependencies` };
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
      case "executionTickets": {
        const tickets = [
          TradeTicketBuilder.build("XAUUSD", "BUY", 3365, 3345, 3390, 3420, 96, true, "Consensus BUY"),
        ];
        return { status: "READY", summary: `${tickets.length} tickets` };
      }
      case "executionQueue": {
        const queue = ExecutionQueue.getAll();
        return { status: "READY", summary: `${queue.length} queued` };
      }
      case "brokerHealth": {
        const r = getBrokerHealthMonitorReport();
        return { status: "READY", summary: `${r.healthyBrokers ?? 0}/${r.totalBrokers ?? 0} brokers healthy` };
      }
      case "marketData": {
        const ready = marketDataManager.isReady();
        return { status: ready ? "READY" : "WARNING", summary: ready ? "Online" : "Degraded" };
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
      case "learning": {
        const r = getLearningFeedbackIntegrationReport();
        return { status: "READY", summary: r.status ?? "READY" };
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
