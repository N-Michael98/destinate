import {
  BrokerId,
  generateSmartBrokerSelectionReport,
} from "../smart-broker-selection";

import {
  BrokerExecutionRoute,
  MockExecutionQueueItem,
  SmartBrokerExecutionRouteResult,
  SmartBrokerExecutionSyncReport,
  SmartBrokerExecutionSyncStatus,
} from "./smart-broker-execution-sync-types";

const VERSION = "V12.1.2" as const;

function getMockExecutionQueueItems(): MockExecutionQueueItem[] {
  return [
    {
      id: "queue-xauusd-scalp-001",
      symbol: "XAUUSD",
      tradeDirection: "LONG",
      tradingStyle: "SCALPING",
      priority: "HIGH",
      requestedAllocationPercent: 100,
      approvalStatus: "APPROVED",
    },
    {
      id: "queue-eurusd-day-001",
      symbol: "EURUSD",
      tradeDirection: "SHORT",
      tradingStyle: "DAYTRADING",
      priority: "MEDIUM",
      requestedAllocationPercent: 100,
      approvalStatus: "APPROVED",
    },
    {
      id: "queue-nas100-swing-001",
      symbol: "NAS100",
      tradeDirection: "LONG",
      tradingStyle: "SWING",
      priority: "HIGH",
      requestedAllocationPercent: 100,
      approvalStatus: "APPROVED",
    },
  ];
}

function getBrokerName(brokerId: BrokerId): string {
  if (brokerId === "IC_MARKETS") return "IC Markets";
  return "Capital.com";
}

function buildRoutes(
  selectedBroker: BrokerId | "MIXED" | "NONE",
  recommendedAllocation: Record<BrokerId, number>,
  brokerScores: {
    brokerId: BrokerId;
    finalScore: number;
    status: string;
  }[]
): BrokerExecutionRoute[] {
  if (selectedBroker === "NONE") {
    return [];
  }

  return brokerScores
    .map((broker) => {
      const allocationPercent = recommendedAllocation[broker.brokerId] ?? 0;

      return {
        brokerId: broker.brokerId,
        brokerName: getBrokerName(broker.brokerId),
        allocationPercent,
        brokerScore: broker.finalScore,
        routeStatus:
          broker.status === "BLOCKED" || allocationPercent <= 0
            ? "BLOCKED"
            : allocationPercent > 0
              ? "ACTIVE"
              : "STANDBY",
      } satisfies BrokerExecutionRoute;
    })
    .filter((route) => route.allocationPercent > 0);
}

function buildRoutingReason(
  selectedBroker: BrokerId | "MIXED" | "NONE",
  symbol: string
): string {
  if (selectedBroker === "NONE") {
    return `${symbol} cannot be routed because no broker is approved.`;
  }

  if (selectedBroker === "MIXED") {
    return `${symbol} is routed with split allocation because multiple brokers passed Smart Broker Selection.`;
  }

  return `${symbol} is routed to ${getBrokerName(
    selectedBroker
  )} because it has the strongest Smart Broker Selection score.`;
}

function syncQueueItemWithSmartBrokerSelection(
  item: MockExecutionQueueItem
): SmartBrokerExecutionRouteResult {
  if (item.approvalStatus !== "APPROVED") {
    return {
      queueItemId: item.id,
      symbol: item.symbol,
      tradeDirection: item.tradeDirection,
      tradingStyle: item.tradingStyle,
      priority: item.priority,
      status: "BLOCKED",
      selectedBroker: "NONE",
      routes: [],
      routingReason: `${item.symbol} is blocked because the queue item is not approved.`,
    };
  }

  const brokerSelectionReport = generateSmartBrokerSelectionReport(
    item.tradingStyle
  );

  const routes = buildRoutes(
    brokerSelectionReport.selectedBroker,
    brokerSelectionReport.recommendedAllocation,
    brokerSelectionReport.brokerScores
  );

  let status: SmartBrokerExecutionSyncStatus = "ROUTED";

  if (
    brokerSelectionReport.selectedBroker === "NONE" ||
    routes.length === 0
  ) {
    status = "BLOCKED";
  } else if (brokerSelectionReport.selectedBroker === "MIXED") {
    status = "MIXED_ROUTE";
  }

  return {
    queueItemId: item.id,
    symbol: item.symbol,
    tradeDirection: item.tradeDirection,
    tradingStyle: item.tradingStyle,
    priority: item.priority,
    status,
    selectedBroker: brokerSelectionReport.selectedBroker,
    routes,
    routingReason: buildRoutingReason(
      brokerSelectionReport.selectedBroker,
      item.symbol
    ),
  };
}

function resolveReportStatus(
  results: SmartBrokerExecutionRouteResult[]
): SmartBrokerExecutionSyncStatus {
  if (results.every((result) => result.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (results.some((result) => result.status === "MIXED_ROUTE")) {
    return "MIXED_ROUTE";
  }

  return "READY";
}

export function generateSmartBrokerExecutionSyncReport(): SmartBrokerExecutionSyncReport {
  const queueItems = getMockExecutionQueueItems();

  const routeResults = queueItems.map(syncQueueItemWithSmartBrokerSelection);

  const routedItems = routeResults.filter(
    (result) => result.status === "ROUTED"
  ).length;

  const mixedRouteItems = routeResults.filter(
    (result) => result.status === "MIXED_ROUTE"
  ).length;

  const blockedItems = routeResults.filter(
    (result) => result.status === "BLOCKED"
  ).length;

  const status = resolveReportStatus(routeResults);

  return {
    version: VERSION,
    status,
    mode: ["SIMULATION", "READ_ONLY", "PAPER_MODE"],
    totalQueueItems: queueItems.length,
    routedItems,
    mixedRouteItems,
    blockedItems,
    routeResults,
    summary:
      "Smart Broker Execution Sync connected approved execution queue items with Smart Broker Selection routing recommendations.",
    safety: {
      liveTradingEnabled: false,
      orderExecutionEnabled: false,
      brokerConnectionMode: "READ_ONLY",
    },
    createdAt: new Date().toISOString(),
  };
}
