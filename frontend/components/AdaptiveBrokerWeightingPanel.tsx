"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";

interface BrokerAdaptiveWeight {
  brokerId: BrokerId;
  brokerName: string;
  executionQualityScore: number;
  baseWeight: number;
  adaptiveAdjustment: number;
  finalWeight: number;
  status: "READY" | "ADJUSTED" | "LEARNING" | "BLOCKED";
  reasons: string[];
  metrics: {
    averageLatencyMs: number;
    averageSpreadPoints: number;
    averageSlippagePoints: number;
    averageFillQualityScore: number;
    averageLiquidityScore: number;
    averageRejectionRiskScore: number;
    totalSamples: number;
  };
}

interface AdaptiveBrokerWeightingReport {
  version: string;
  status: "READY" | "ADJUSTED" | "LEARNING" | "BLOCKED";
  mode: string[];
  totalBrokers: number;
  bestWeightedBroker: BrokerId | "NONE";
  weakestWeightedBroker: BrokerId | "NONE";
  brokerWeights: BrokerAdaptiveWeight[];
  normalizedWeights: Record<BrokerId, number>;
  summary: string;
  learningNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    weightingMode: "SIMULATED_ADAPTIVE_BROKER_WEIGHTING";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "READY" || status === "ADJUSTED") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "LEARNING") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getBrokerLabel(brokerId: BrokerId | "NONE") {
  if (brokerId === "IC_MARKETS") return "IC Markets";
  if (brokerId === "CAPITAL_COM") return "Capital.com";
  return "None";
}

function getAdjustmentLabel(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function AdaptiveBrokerWeightingPanel() {
  const [report, setReport] = useState<AdaptiveBrokerWeightingReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/adaptive-broker-weighting", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Adaptive Broker Weighting:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedWeights = useMemo(() => {
    return [...(report?.brokerWeights ?? [])].sort(
      (a, b) => b.finalWeight - a.finalWeight
    );
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.4.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Adaptive Broker Weighting
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert adaptive Broker-Gewichtung aus Execution Quality
            Memory, Base Weight, Learning Adjustment und normalisierter
            Multi-Broker-Allokation.
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
          Lade Adaptive Broker Weighting Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Brokers" value={report.totalBrokers} />
            <SummaryCard
              label="Best Weighted"
              value={getBrokerLabel(report.bestWeightedBroker)}
            />
            <SummaryCard
              label="Weakest Weighted"
              value={getBrokerLabel(report.weakestWeightedBroker)}
            />
            <SummaryCard
              label="Weighting Mode"
              value={report.safety.weightingMode}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <NormalizedWeightCard
              brokerName="IC Markets"
              value={report.normalizedWeights.IC_MARKETS}
            />
            <NormalizedWeightCard
              brokerName="Capital.com"
              value={report.normalizedWeights.CAPITAL_COM}
            />
          </div>

          <div className="space-y-4">
            {rankedWeights.map((broker, index) => (
              <div
                key={broker.brokerId}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                        Rank #{index + 1}
                      </span>

                      <h3 className="text-xl font-bold text-white">
                        {broker.brokerName}
                      </h3>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                          broker.status
                        )}`}
                      >
                        {broker.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Execution Quality:{" "}
                      <span className="font-bold text-white">
                        {broker.executionQualityScore}
                      </span>{" "}
                      · Samples:{" "}
                      <span className="font-bold text-cyan-300">
                        {broker.metrics.totalSamples}
                      </span>
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Final Weight
                    </p>
                    <p className="mt-1 text-4xl font-black text-white">
                      {broker.finalWeight}
                    </p>
                  </div>
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-4">
                  <WeightMetric label="Base Weight" value={broker.baseWeight} />
                  <WeightMetric
                    label="Adaptive Adj."
                    value={getAdjustmentLabel(broker.adaptiveAdjustment)}
                  />
                  <WeightMetric
                    label="Final Weight"
                    value={broker.finalWeight}
                  />
                  <WeightMetric
                    label="Normalized"
                    value={`${report.normalizedWeights[broker.brokerId]}%`}
                  />
                </div>

                <div className="mb-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: clampWidth(broker.finalWeight) }}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-6">
                  <BrokerMetric
                    label="Latency"
                    value={`${broker.metrics.averageLatencyMs}ms`}
                  />
                  <BrokerMetric
                    label="Spread"
                    value={broker.metrics.averageSpreadPoints}
                  />
                  <BrokerMetric
                    label="Slippage"
                    value={broker.metrics.averageSlippagePoints}
                  />
                  <BrokerMetric
                    label="Fill"
                    value={broker.metrics.averageFillQualityScore}
                  />
                  <BrokerMetric
                    label="Liquidity"
                    value={broker.metrics.averageLiquidityScore}
                  />
                  <BrokerMetric
                    label="Reject Risk"
                    value={broker.metrics.averageRejectionRiskScore}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-bold text-cyan-300">
                    Adaptive Weighting Reasons
                  </p>

                  <ul className="space-y-2 text-sm text-slate-300">
                    {broker.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white">Learning Notes</h3>

              <div className="mt-4 space-y-2">
                {report.learningNotes.map((note) => (
                  <div
                    key={note}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300"
                  >
                    {note}
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm text-slate-400">{report.summary}</p>
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
                  {report.safety.weightingMode}
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
          Adaptive Broker Weighting Daten konnten nicht geladen werden.
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 break-words text-xl font-black text-white">{value}</p>
    </div>
  );
}

function NormalizedWeightCard({
  brokerName,
  value,
}: {
  brokerName: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{brokerName}</h3>
        <span className="text-2xl font-black text-cyan-300">{value}%</span>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Normalized adaptive broker allocation
      </p>

      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: clampWidth(value) }}
        />
      </div>
    </div>
  );
}

function WeightMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function BrokerMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
