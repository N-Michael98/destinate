import type {
  BrokerHealthMonitorReport,
  BrokerHealthSnapshot,
  BrokerHealthStatus,
  BrokerName,
} from "./broker-health-monitor-types";

function calculateRiskScore(leverage: number, latency: number, spread: number, maxSpread: number) {
  const leverageRisk = leverage >= 500 ? 35 : leverage >= 200 ? 22 : 12;
  const latencyRisk = latency > 250 ? 25 : latency > 120 ? 15 : 5;
  const spreadRisk = spread > maxSpread ? 30 : spread > maxSpread * 0.7 ? 15 : 5;

  return Math.min(100, leverageRisk + latencyRisk + spreadRisk);
}

function calculateBrokerScore(
  executionQualityScore: number,
  liquidityScore: number,
  riskScore: number,
  latency: number,
  spread: number,
  maxSpread: number,
) {
  const latencyBonus = latency <= 120 ? 10 : latency <= 250 ? 5 : 0;
  const spreadBonus = spread <= maxSpread * 0.5 ? 10 : spread <= maxSpread ? 5 : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        executionQualityScore * 0.4 +
          liquidityScore * 0.3 +
          (100 - riskScore) * 0.2 +
          latencyBonus +
          spreadBonus,
      ),
    ),
  );
}

function resolveHealthStatus(riskScore: number, brokerScore: number): BrokerHealthStatus {
  if (riskScore >= 75 || brokerScore < 45) return "CRITICAL";
  if (riskScore >= 55 || brokerScore < 70) return "WARNING";
  return "HEALTHY";
}

function buildBrokerHealthSnapshot(input: {
  broker: BrokerName;
  leverage: number;
  averageLatencyMs: number;
  currentSpreadPoints: number;
  maxAllowedSpreadPoints: number;
  executionQualityScore: number;
  liquidityScore: number;
}): BrokerHealthSnapshot {
  const riskScore = calculateRiskScore(
    input.leverage,
    input.averageLatencyMs,
    input.currentSpreadPoints,
    input.maxAllowedSpreadPoints,
  );

  const brokerScore = calculateBrokerScore(
    input.executionQualityScore,
    input.liquidityScore,
    riskScore,
    input.averageLatencyMs,
    input.currentSpreadPoints,
    input.maxAllowedSpreadPoints,
  );

  const apiHealth = resolveHealthStatus(riskScore, brokerScore);

  const canRouteOrders = apiHealth !== "CRITICAL";
  const shouldReduceSize = riskScore >= 55 || input.leverage >= 500;
  const shouldBlockNewOrders = apiHealth === "CRITICAL";

  const reason =
    apiHealth === "HEALTHY"
      ? `${input.broker}: Broker health is healthy. Demo/read-only routing can continue.`
      : apiHealth === "WARNING"
        ? `${input.broker}: Broker health warning. Reduce size or require stronger confirmation.`
        : `${input.broker}: Broker health critical. Block new routing until conditions improve.`;

  return {
    broker: input.broker,
    connectionStatus: apiHealth === "CRITICAL" ? "DEGRADED" : "ONLINE",
    apiHealth,
    demoMode: true,
    readOnlyMode: true,
    liveExecutionEnabled: false,
    leverage: input.leverage,
    averageLatencyMs: input.averageLatencyMs,
    currentSpreadPoints: input.currentSpreadPoints,
    maxAllowedSpreadPoints: input.maxAllowedSpreadPoints,
    executionQualityScore: input.executionQualityScore,
    liquidityScore: input.liquidityScore,
    riskScore,
    brokerScore,
    canRouteOrders,
    shouldReduceSize,
    shouldBlockNewOrders,
    reason,
    updatedAt: new Date().toISOString(),
  };
}

export function getBrokerHealthMonitorReport(): BrokerHealthMonitorReport {
  const brokers = [
    buildBrokerHealthSnapshot({
      broker: "IC_MARKETS",
      leverage: 500,
      averageLatencyMs: 95,
      currentSpreadPoints: 1.2,
      maxAllowedSpreadPoints: 2,
      executionQualityScore: 88,
      liquidityScore: 92,
    }),
    buildBrokerHealthSnapshot({
      broker: "CAPITAL_COM",
      leverage: 200,
      averageLatencyMs: 140,
      currentSpreadPoints: 1.8,
      maxAllowedSpreadPoints: 3,
      executionQualityScore: 82,
      liquidityScore: 84,
    }),
  ];

  const healthyBrokers = brokers.filter((broker) => broker.apiHealth === "HEALTHY").length;
  const warningBrokers = brokers.filter((broker) => broker.apiHealth === "WARNING").length;
  const criticalBrokers = brokers.filter((broker) => broker.apiHealth === "CRITICAL").length;

  const rankedBrokers = [...brokers].sort((a, b) => b.brokerScore - a.brokerScore);

  const bestBroker = rankedBrokers[0]?.broker ?? "NONE";
  const worstBroker = rankedBrokers[rankedBrokers.length - 1]?.broker ?? "NONE";

  const recommendation =
    criticalBrokers > 0
      ? "At least one broker is critical. Block new orders on critical brokers and route only through healthy alternatives."
      : warningBrokers > 0
        ? "At least one broker has warning status. Reduce size and prefer the highest broker score."
        : "Both brokers are healthy in demo/read-only mode. Prefer the broker with the highest score while keeping live execution disabled.";

  return {
    version: "V12.0.7",
    status: "READY",
    mode: "SIMULATION",
    totalBrokers: brokers.length,
    healthyBrokers,
    warningBrokers,
    criticalBrokers,
    bestBroker,
    worstBroker,
    liveExecutionEnabled: false,
    readOnlyMode: true,
    brokers,
    systemRule:
      "Broker Health Monitor evaluates IC Markets and Capital.com using latency, spread, leverage risk, liquidity and execution quality. Live execution remains disabled.",
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}
