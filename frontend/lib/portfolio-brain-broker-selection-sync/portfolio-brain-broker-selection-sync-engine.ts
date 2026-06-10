import { generatePortfolioBrainEvolutionSyncReport } from "@/lib/portfolio-brain-evolution-sync";
import { generateSmartBrokerSelectionReport } from "@/lib/smart-broker-selection";

import {
  PortfolioBrokerRoutingMode,
  PortfolioBrokerSelectionDecision,
  PortfolioBrainBrokerSelectionSyncReport,
} from "./portfolio-brain-broker-selection-sync-types";

const VERSION = "V16.1.5" as const;

function normalizeStyle(route: string): "SCALPING" | "DAYTRADING" | "SWING" {
  if (route.includes("SCALP")) return "SCALPING";
  if (route.includes("DAYTRADE")) return "DAYTRADING";
  if (route.includes("SWING")) return "SWING";
  return "SWING";
}

function resolveBrokerRoutingMode(params: {
  consensusMode: string;
  bestBrokerRoutingMode: string;
}): PortfolioBrokerRoutingMode {
  if (params.consensusMode === "CONSENSUS_ELITE") {
    return "DUAL_BROKER_PRIORITY";
  }

  if (
    params.consensusMode === "CONSENSUS_APPROVED" ||
    params.bestBrokerRoutingMode === "DUAL_BROKER_CHECK"
  ) {
    return "DUAL_BROKER_CHECK";
  }

  if (params.consensusMode === "CONSENSUS_STRICT") {
    return "SINGLE_BROKER_CHECK";
  }

  return "NO_BROKER_ROUTE";
}

function resolveBrokerPair(selectedBroker: string, routingMode: PortfolioBrokerRoutingMode) {
  if (routingMode === "NO_BROKER_ROUTE") {
    return {
      primaryBroker: "NO_BROKER",
      secondaryBroker: "NO_BROKER",
    };
  }

  if (selectedBroker === "IC_MARKETS") {
    return {
      primaryBroker: "IC_MARKETS",
      secondaryBroker:
        routingMode === "SINGLE_BROKER_CHECK" ? "NO_BROKER" : "CAPITAL_COM",
    };
  }

  if (selectedBroker === "CAPITAL_COM") {
    return {
      primaryBroker: "CAPITAL_COM",
      secondaryBroker:
        routingMode === "SINGLE_BROKER_CHECK" ? "NO_BROKER" : "IC_MARKETS",
    };
  }

  return {
    primaryBroker: "IC_MARKETS",
    secondaryBroker:
      routingMode === "SINGLE_BROKER_CHECK" ? "NO_BROKER" : "CAPITAL_COM",
  };
}

function resolveAllocation(params: {
  brokerId: "CAPITAL_COM" | "IC_MARKETS";
  selectedBroker: string;
  routingMode: PortfolioBrokerRoutingMode;
  smartAllocation: Record<"CAPITAL_COM" | "IC_MARKETS", number>;
}) {
  if (params.routingMode === "NO_BROKER_ROUTE") return 0;

  if (params.routingMode === "SINGLE_BROKER_CHECK") {
    return params.selectedBroker === params.brokerId ? 100 : 0;
  }

  if (params.routingMode === "DUAL_BROKER_PRIORITY") {
    if (params.selectedBroker === params.brokerId) return 70;
    return 30;
  }

  return params.smartAllocation[params.brokerId] ?? 0;
}

function buildDecision(): PortfolioBrokerSelectionDecision {
  const portfolio = generatePortfolioBrainEvolutionSyncReport();
  const signal = portfolio.consensusPortfolioSignal;

  const primaryStyle = normalizeStyle(signal.bestPortfolioRoute);
  const smartBroker = generateSmartBrokerSelectionReport(primaryStyle);

  const brokerRoutingMode = resolveBrokerRoutingMode({
    consensusMode: signal.bestConsensusMode,
    bestBrokerRoutingMode: signal.bestBrokerRoutingMode,
  });

  const selectedBroker =
    brokerRoutingMode === "NO_BROKER_ROUTE"
      ? "NONE"
      : smartBroker.selectedBroker;

  const brokerPair = resolveBrokerPair(selectedBroker, brokerRoutingMode);

  const capitalComAllocation = resolveAllocation({
    brokerId: "CAPITAL_COM",
    selectedBroker,
    routingMode: brokerRoutingMode,
    smartAllocation: smartBroker.recommendedAllocation,
  });

  const icMarketsAllocation = resolveAllocation({
    brokerId: "IC_MARKETS",
    selectedBroker,
    routingMode: brokerRoutingMode,
    smartAllocation: smartBroker.recommendedAllocation,
  });

  const approvalRequired =
    signal.bestConsensusMode === "CONSENSUS_STRICT" ||
    brokerRoutingMode === "SINGLE_BROKER_CHECK";

  const reason =
    brokerRoutingMode === "NO_BROKER_ROUTE"
      ? `${signal.bestConsensusSymbol}: Broker selection blocked because Portfolio Brain has no approved consensus route.`
      : `${signal.bestConsensusSymbol}: Portfolio Brain selected ${signal.bestConsensusMode} with ${signal.portfolioPriority} priority. Smart Broker Selection recommends ${selectedBroker} using ${primaryStyle} context.`;

  return {
    id: `portfolio-brain-broker-selection-${signal.bestConsensusSymbol.toLowerCase()}`,
    symbol: signal.bestConsensusSymbol,
    primaryStyle,
    consensusMode: signal.bestConsensusMode,
    consensusLevel: signal.bestConsensusLevel,
    portfolioPriority: signal.portfolioPriority,
    brokerRoutingMode,
    selectedBroker,
    primaryBroker: brokerPair.primaryBroker,
    secondaryBroker: brokerPair.secondaryBroker,
    capitalComAllocation,
    icMarketsAllocation,
    executionPriority: signal.bestExecutionPriority,
    finalPositionSize: signal.bestFinalPositionSize,
    riskAdjustment: portfolio.portfolioRiskAdjustment,
    approvalRequired,
    brokerSelectionSummary: smartBroker.summary,
    reason,
  };
}

export function generatePortfolioBrainBrokerSelectionSyncReport():
  PortfolioBrainBrokerSelectionSyncReport {
  const decision = buildDecision();
  const decisions = [decision];

  const dualBrokerPrioritySymbols = decisions.filter(
    (item) => item.brokerRoutingMode === "DUAL_BROKER_PRIORITY"
  ).length;

  const dualBrokerCheckSymbols = decisions.filter(
    (item) => item.brokerRoutingMode === "DUAL_BROKER_CHECK"
  ).length;

  const singleBrokerCheckSymbols = decisions.filter(
    (item) => item.brokerRoutingMode === "SINGLE_BROKER_CHECK"
  ).length;

  const blockedSymbols = decisions.filter(
    (item) => item.brokerRoutingMode === "NO_BROKER_ROUTE"
  ).length;

  const tradable = decisions.filter(
    (item) => item.brokerRoutingMode !== "NO_BROKER_ROUTE"
  );

  const bestDecision =
    tradable.length === 0
      ? null
      : [...tradable].sort(
          (a, b) => b.executionPriority - a.executionPriority
        )[0];

  const recommendation =
    bestDecision === null
      ? "No Portfolio Brain broker selection route is approved. Keep broker execution blocked."
      : `${bestDecision.symbol} should proceed to ${bestDecision.brokerRoutingMode} with primary broker ${bestDecision.primaryBroker}.`;

  return {
    version: VERSION,
    status: "READY",
    mode: "SIMULATION",
    totalSymbols: decisions.length,
    dualBrokerPrioritySymbols,
    dualBrokerCheckSymbols,
    singleBrokerCheckSymbols,
    blockedSymbols,
    bestDecision,
    decisions,
    systemRule:
      "Portfolio Brain Broker Selection Sync converts Portfolio Brain consensus allocation into broker selection preferences while keeping live execution disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
