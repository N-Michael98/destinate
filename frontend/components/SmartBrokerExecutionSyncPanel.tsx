"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";
type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

interface BrokerExecutionRoute {
  brokerId: BrokerId;
  brokerName: string;
  allocationPercent: number;
  brokerScore: number;
  routeStatus: "ACTIVE" | "STANDBY" | "BLOCKED";
}

interface SmartBrokerExecutionRouteResult {
  queueItemId: string;
  symbol: string;
  tradeDirection: "LONG" | "SHORT";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "READY" | "ROUTED" | "MIXED_ROUTE" | "BLOCKED";
  selectedBroker: BrokerId | "MIXED" | "NONE";
  routes: BrokerExecutionRoute[];
  routingReason: string;
}

interface SmartBrokerExecutionSyncReport {
  version: string;
  status: "READY" | "ROUTED" | "MIXED_ROUTE" | "BLOCKED";
  mode: string[];
  totalQueueItems: number;
  routedItems: number;
  mixedRouteItems: number;
  blockedItems: number;
  routeResults: SmartBrokerExecutionRouteResult[];
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "READY" || status === "ROUTED" || status === "ACTIVE") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "MIXED_ROUTE" || status === "STANDBY") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getPriorityClass(priority: string) {
  if (priority === "HIGH") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  }

  if (priority === "MEDIUM") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  return "border-slate-500/40 bg-slate-500/10 text-slate-300";
}

function getDirectionClass(direction: string) {
  if (direction === "LONG") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

export default function SmartBrokerExecutionSyncPanel() {
  const [report, setReport] = useState<SmartBrokerExecutionSyncReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/smart-broker-execution-sync", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error(
          "Failed to load Smart Broker Execution Sync report:",
          error
        );
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const brokerTotals = useMemo(() => {
    const totals: Record<BrokerId, number> = {
      CAPITAL_COM: 0,
      IC_MARKETS: 0,
    };

    for (const item of report?.routeResults ?? []) {
      for (const route of item.routes) {
        totals[route.brokerId] += route.allocationPercent;
      }
    }

    return totals;
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.1.3
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Smart Broker Execution Sync
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Verbindet Execution Queue Items mit Smart Broker Selection und
            erzeugt dynamische Broker-Routing-Allokationen.
          </p>
        </div>

        {report && (
          <div
            className={`rounded-full border px-4 py-2 text-xs font-bold ${getStatusClass(
              report.status
            )}`}
          >
            {report.status}
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
          Lade Smart Broker Execution Sync Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Queue Items" value={report.totalQueueItems} />
            <SummaryCard label="Routed" value={report.routedItems} />
            <SummaryCard label="Mixed Route" value={report.mixedRouteItems} />
            <SummaryCard label="Blocked" value={report.blockedItems} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BrokerTotalCard
              brokerName="IC Markets"
              value={brokerTotals.IC_MARKETS}
              totalItems={report.totalQueueItems}
            />
            <BrokerTotalCard
              brokerName="Capital.com"
              value={brokerTotals.CAPITAL_COM}
              totalItems={report.totalQueueItems}
            />
          </div>

          <div className="space-y-4">
            {report.routeResults.map((item) => (
              <div
                key={item.queueItemId}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-white">
                        {item.symbol}
                      </h3>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getDirectionClass(
                          item.tradeDirection
                        )}`}
                      >
                        {item.tradeDirection}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getPriorityClass(
                          item.priority
                        )}`}
                      >
                        {item.priority}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Style:{" "}
                      <span className="font-bold text-cyan-300">
                        {item.tradingStyle}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-bold text-slate-300">
                      Selected: {item.selectedBroker}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {item.routes.map((route) => (
                    <div
                      key={`${item.queueItemId}-${route.brokerId}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white">
                            {route.brokerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Score {route.brokerScore}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            route.routeStatus
                          )}`}
                        >
                          {route.routeStatus}
                        </span>
                      </div>

                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-slate-400">Allocation</span>
                        <span className="font-bold text-cyan-300">
                          {route.allocationPercent}%
                        </span>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${route.allocationPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
                  {item.routingReason}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white">Sync Summary</h3>
              <p className="mt-3 text-sm text-slate-400">{report.summary}</p>
              <p className="mt-3 text-xs text-slate-500">
                Created: {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white">Safety Mode</h3>

              <div className="mt-4 flex flex-wrap gap-2">
                {report.mode.map((mode) => (
                  <span
                    key={mode}
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300"
                  >
                    {mode}
                  </span>
                ))}
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                  {report.safety.brokerConnectionMode}
                </span>
              </div>

              <p className="mt-4 text-sm text-slate-400">
                Live Trading:{" "}
                <span className="font-bold text-red-300">
                  {String(report.safety.liveTradingEnabled)}
                </span>{" "}
                · Order Execution:{" "}
                <span className="font-bold text-red-300">
                  {String(report.safety.orderExecutionEnabled)}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Smart Broker Execution Sync Daten konnten nicht geladen werden.
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function BrokerTotalCard({
  brokerName,
  value,
  totalItems,
}: {
  brokerName: string;
  value: number;
  totalItems: number;
}) {
  const max = Math.max(totalItems * 100, 1);
  const percent = Math.round((value / max) * 100);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{brokerName}</h3>
        <span className="text-xl font-black text-cyan-300">{value}%</span>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Total allocation across active queue routes
      </p>

      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
