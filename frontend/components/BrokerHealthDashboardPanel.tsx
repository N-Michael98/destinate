"use client";

import { useEffect, useState } from "react";

type BrokerHealthSnapshot = {
  broker: string;
  connectionStatus: string;
  apiHealth: string;
  demoMode: boolean;
  readOnlyMode: boolean;
  liveExecutionEnabled: boolean;
  leverage: number;
  averageLatencyMs: number;
  currentSpreadPoints: number;
  maxAllowedSpreadPoints: number;
  executionQualityScore: number;
  liquidityScore: number;
  riskScore: number;
  brokerScore: number;
  canRouteOrders: boolean;
  shouldReduceSize: boolean;
  shouldBlockNewOrders: boolean;
  reason: string;
  updatedAt: string;
};

type BrokerHealthResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalBrokers: number;
    healthyBrokers: number;
    warningBrokers: number;
    criticalBrokers: number;
    bestBroker: string;
    worstBroker: string;
    liveExecutionEnabled: boolean;
    readOnlyMode: boolean;
    brokers: BrokerHealthSnapshot[];
    systemRule: string;
    recommendation: string;
    updatedAt: string;
  };
};

export default function BrokerHealthDashboardPanel() {
  const [data, setData] = useState<BrokerHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBrokerHealth() {
      try {
        const response = await fetch("/api/broker-health-monitor", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Broker Health Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadBrokerHealth();
  }, []);

  const report = data?.report;
  const brokers = report?.brokers ?? [];

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-slate-950/80 p-6 shadow-lg shadow-emerald-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-emerald-300">
            V12.0.9 Broker Health Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Überwacht IC Markets und Capital.com nach Health, Spread, Latency, Risk und Broker Score.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Broker Health Monitor wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Broker Health Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <MetricCard title="Total Brokers" value={report.totalBrokers} />
            <MetricCard title="Healthy" value={report.healthyBrokers} positive={report.healthyBrokers > 0} />
            <MetricCard title="Warning" value={report.warningBrokers} negative={report.warningBrokers > 0} />
            <MetricCard title="Critical" value={report.criticalBrokers} negative={report.criticalBrokers > 0} />
            <MetricCard title="Best Broker" value={report.bestBroker} positive={report.bestBroker !== "NONE"} />
            <MetricCard title="Read Only" value={report.readOnlyMode ? "YES" : "NO"} positive={report.readOnlyMode} />
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-emerald-300">
              Broker Health Rule
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Latency" value="Execution Speed" />
              <RouteBox title="Spread" value="Trading Cost" />
              <RouteBox title="Leverage" value="Risk Factor" />
              <RouteBox title="Broker Score" value="Route Ranking" />
              <RouteBox title="Execution" value="Read Only" />
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {report.systemRule}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {brokers.map((broker) => (
              <div
                key={broker.broker}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5"
              >
                <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-emerald-200">
                      {broker.broker}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {broker.connectionStatus} | Demo: {broker.demoMode ? "YES" : "NO"} | Read Only: {broker.readOnlyMode ? "YES" : "NO"}
                    </p>
                  </div>

                  <HealthBadge health={broker.apiHealth} />
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <MetricCard
                    title="Broker Score"
                    value={broker.brokerScore}
                    positive={broker.brokerScore >= 80}
                    negative={broker.brokerScore < 60}
                  />
                  <MetricCard
                    title="Risk Score"
                    value={broker.riskScore}
                    positive={broker.riskScore < 50}
                    negative={broker.riskScore >= 70}
                  />
                  <MetricCard
                    title="Latency"
                    value={`${broker.averageLatencyMs}ms`}
                    positive={broker.averageLatencyMs <= 120}
                    negative={broker.averageLatencyMs > 250}
                  />
                  <MetricCard
                    title="Leverage"
                    value={`1:${broker.leverage}`}
                    negative={broker.leverage >= 500}
                  />
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <MetricCard
                    title="Spread"
                    value={broker.currentSpreadPoints}
                    positive={broker.currentSpreadPoints <= broker.maxAllowedSpreadPoints}
                    negative={broker.currentSpreadPoints > broker.maxAllowedSpreadPoints}
                  />
                  <MetricCard
                    title="Max Spread"
                    value={broker.maxAllowedSpreadPoints}
                  />
                  <MetricCard
                    title="Execution Quality"
                    value={broker.executionQualityScore}
                    positive={broker.executionQualityScore >= 80}
                    negative={broker.executionQualityScore < 60}
                  />
                  <MetricCard
                    title="Liquidity"
                    value={broker.liquidityScore}
                    positive={broker.liquidityScore >= 80}
                    negative={broker.liquidityScore < 60}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FlagCard
                    title="Can Route Orders"
                    value={broker.canRouteOrders ? "YES" : "NO"}
                    positive={broker.canRouteOrders}
                    negative={!broker.canRouteOrders}
                  />
                  <FlagCard
                    title="Reduce Size"
                    value={broker.shouldReduceSize ? "YES" : "NO"}
                    negative={broker.shouldReduceSize}
                    positive={!broker.shouldReduceSize}
                  />
                  <FlagCard
                    title="Block New Orders"
                    value={broker.shouldBlockNewOrders ? "YES" : "NO"}
                    negative={broker.shouldBlockNewOrders}
                    positive={!broker.shouldBlockNewOrders}
                  />
                </div>

                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Reason</p>
                  <p className="mt-1 text-sm font-semibold text-slate-300">
                    {broker.reason}
                  </p>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Updated At: {broker.updatedAt}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <p className="text-xs text-slate-400">Recommendation</p>
            <p className="mt-1 text-sm font-semibold text-cyan-200">
              {report.recommendation}
            </p>
          </div>

          <div className="text-xs text-slate-500">
            Engine Version: {report.version} | Mode: {report.mode} | Updated At: {report.updatedAt}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: string | number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          positive
            ? "text-emerald-400"
            : negative
              ? "text-red-400"
              : "text-emerald-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FlagCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={`mt-2 text-xl font-bold ${
          positive
            ? "text-emerald-400"
            : negative
              ? "text-red-400"
              : "text-slate-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-emerald-200">{value}</p>
    </div>
  );
}

function HealthBadge({ health }: { health: string }) {
  const className =
    health === "HEALTHY"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : health === "WARNING"
        ? "border-orange-500/30 bg-orange-950/40 text-orange-300"
        : "border-red-500/30 bg-red-950/40 text-red-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {health}
    </span>
  );
}
