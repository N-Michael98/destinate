"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";
type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

interface BrokerPositionAllocation {
  brokerId: BrokerId;
  brokerName: string;
  allocationPercent: number;
  brokerScore: number;
  lotSize: number;
  notionalRiskPercent: number;
  status: "ACTIVE" | "SKIPPED" | "BLOCKED";
  reason: string;
}

interface DynamicPositionAllocationResult {
  queueItemId: string;
  symbol: string;
  tradeDirection: "LONG" | "SHORT";
  tradingStyle: TradingStyle;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "READY" | "ALLOCATED" | "PARTIAL_ALLOCATION" | "BLOCKED";
  selectedBroker: BrokerId | "MIXED" | "NONE";
  totalRequestedLots: number;
  totalAllocatedLots: number;
  unallocatedLots: number;
  riskPercent: number;
  confidenceScore: number;
  allocations: BrokerPositionAllocation[];
  allocationReason: string;
}

interface DynamicPositionAllocationReport {
  version: string;
  status: "READY" | "ALLOCATED" | "PARTIAL_ALLOCATION" | "BLOCKED";
  mode: string[];
  totalItems: number;
  allocatedItems: number;
  partialAllocationItems: number;
  blockedItems: number;
  totalRequestedLots: number;
  totalAllocatedLots: number;
  totalUnallocatedLots: number;
  results: DynamicPositionAllocationResult[];
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    allocationMode: "SIMULATED_POSITION_SPLIT";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "READY" || status === "ALLOCATED" || status === "ACTIVE") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "PARTIAL_ALLOCATION" || status === "SKIPPED") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getDirectionClass(direction: string) {
  if (direction === "LONG") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
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

export default function DynamicPositionAllocationPanel() {
  const [report, setReport] = useState<DynamicPositionAllocationReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/dynamic-position-allocation", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Dynamic Position Allocation:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const brokerExposure = useMemo(() => {
    const exposure: Record<
      BrokerId,
      {
        brokerName: string;
        totalLots: number;
        totalRisk: number;
        averageScore: number;
        scoreCount: number;
      }
    > = {
      CAPITAL_COM: {
        brokerName: "Capital.com",
        totalLots: 0,
        totalRisk: 0,
        averageScore: 0,
        scoreCount: 0,
      },
      IC_MARKETS: {
        brokerName: "IC Markets",
        totalLots: 0,
        totalRisk: 0,
        averageScore: 0,
        scoreCount: 0,
      },
    };

    for (const result of report?.results ?? []) {
      for (const allocation of result.allocations) {
        exposure[allocation.brokerId].totalLots += allocation.lotSize;
        exposure[allocation.brokerId].totalRisk += allocation.notionalRiskPercent;
        exposure[allocation.brokerId].averageScore += allocation.brokerScore;
        exposure[allocation.brokerId].scoreCount += 1;
      }
    }

    for (const brokerId of Object.keys(exposure) as BrokerId[]) {
      const broker = exposure[brokerId];
      broker.totalLots = Math.round(broker.totalLots * 100) / 100;
      broker.totalRisk = Math.round(broker.totalRisk * 100) / 100;
      broker.averageScore =
        broker.scoreCount > 0
          ? Math.round(broker.averageScore / broker.scoreCount)
          : 0;
    }

    return exposure;
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.2.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Dynamic Position Allocation
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Wandelt Smart-Broker-Routing-Prozente in simulierte Broker-Lotgrößen
            und Risiko-Allokationen um.
          </p>
        </div>

        {report && (
          <span
            className={`rounded-full border px-4 py-2 text-xs font-bold ${getStatusClass(
              report.status
            )}`}
          >
            {report.status}
          </span>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
          Lade Dynamic Position Allocation Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Items" value={report.totalItems} />
            <SummaryCard label="Allocated" value={report.allocatedItems} />
            <SummaryCard
              label="Partial"
              value={report.partialAllocationItems}
            />
            <SummaryCard label="Blocked" value={report.blockedItems} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <LotCard
              label="Requested Lots"
              value={report.totalRequestedLots}
              description="Total normalized requested size"
            />
            <LotCard
              label="Allocated Lots"
              value={report.totalAllocatedLots}
              description="Total simulated broker allocation"
            />
            <LotCard
              label="Unallocated Lots"
              value={report.totalUnallocatedLots}
              description="Remaining not allocated size"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BrokerExposureCard broker={brokerExposure.IC_MARKETS} />
            <BrokerExposureCard broker={brokerExposure.CAPITAL_COM} />
          </div>

          <div className="space-y-4">
            {report.results.map((result) => (
              <div
                key={result.queueItemId}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-white">
                        {result.symbol}
                      </h3>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getDirectionClass(
                          result.tradeDirection
                        )}`}
                      >
                        {result.tradeDirection}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getPriorityClass(
                          result.priority
                        )}`}
                      >
                        {result.priority}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                          result.status
                        )}`}
                      >
                        {result.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Style:{" "}
                      <span className="font-bold text-cyan-300">
                        {result.tradingStyle}
                      </span>{" "}
                      · Selected Broker:{" "}
                      <span className="font-bold text-white">
                        {result.selectedBroker}
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-right">
                    <MiniMetric label="Lots" value={result.totalAllocatedLots} />
                    <MiniMetric label="Risk" value={`${result.riskPercent}%`} />
                    <MiniMetric
                      label="Confidence"
                      value={result.confidenceScore}
                    />
                  </div>
                </div>

                <div className="mb-4 grid gap-3 lg:grid-cols-3">
                  <AllocationMetric
                    label="Requested"
                    value={`${result.totalRequestedLots} lots`}
                  />
                  <AllocationMetric
                    label="Allocated"
                    value={`${result.totalAllocatedLots} lots`}
                  />
                  <AllocationMetric
                    label="Unallocated"
                    value={`${result.unallocatedLots} lots`}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {result.allocations.map((allocation) => (
                    <div
                      key={`${result.queueItemId}-${allocation.brokerId}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-white">
                            {allocation.brokerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Broker Score {allocation.brokerScore}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            allocation.status
                          )}`}
                        >
                          {allocation.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <MiniMetric
                          label="Allocation"
                          value={`${allocation.allocationPercent}%`}
                        />
                        <MiniMetric
                          label="Lot Size"
                          value={allocation.lotSize}
                        />
                        <MiniMetric
                          label="Risk"
                          value={`${allocation.notionalRiskPercent}%`}
                        />
                      </div>

                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{
                            width: `${allocation.allocationPercent}%`,
                          }}
                        />
                      </div>

                      <p className="mt-3 text-xs text-slate-400">
                        {allocation.reason}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
                  {result.allocationReason}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white">
                Allocation Summary
              </h3>
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

                <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                  {report.safety.allocationMode}
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
          Dynamic Position Allocation Daten konnten nicht geladen werden.
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

function LotCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-cyan-300">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function BrokerExposureCard({
  broker,
}: {
  broker: {
    brokerName: string;
    totalLots: number;
    totalRisk: number;
    averageScore: number;
  };
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{broker.brokerName}</h3>
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
          Exposure
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniMetric label="Lots" value={broker.totalLots} />
        <MiniMetric label="Risk" value={`${broker.totalRisk}%`} />
        <MiniMetric label="Avg Score" value={broker.averageScore} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function AllocationMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
