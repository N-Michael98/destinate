"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";

type BrokerOptimizationAction =
  | "INCREASE_WEIGHT"
  | "DECREASE_WEIGHT"
  | "HOLD_WEIGHT"
  | "BLOCK_BROKER";

interface BrokerOptimizationProfile {
  brokerId: BrokerId;
  brokerName: string;
  currentNormalizedWeight: number;
  executionQualityScore: number;
  finalAdaptiveWeight: number;
  trendScore: number;
  reliabilityScore: number;
  optimizationConfidence: number;
  recommendedWeight: number;
  recommendedAction: BrokerOptimizationAction;
  status: "READY" | "OPTIMIZED" | "MONITORING" | "BLOCKED";
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

interface AutonomousBrokerOptimizationReport {
  version: string;
  status: "READY" | "OPTIMIZED" | "MONITORING" | "BLOCKED";
  mode: string[];
  totalBrokers: number;
  recommendedBroker: BrokerId | "NONE";
  strongestBroker: BrokerId | "NONE";
  weakestBroker: BrokerId | "NONE";
  optimizationProfiles: BrokerOptimizationProfile[];
  optimizedWeights: Record<BrokerId, number>;
  summary: string;
  optimizationNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    optimizationMode: "SIMULATED_AUTONOMOUS_BROKER_OPTIMIZATION";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "READY" || status === "OPTIMIZED") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "MONITORING") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getActionClass(action: BrokerOptimizationAction) {
  if (action === "INCREASE_WEIGHT") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (action === "DECREASE_WEIGHT") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  if (action === "HOLD_WEIGHT") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getBrokerLabel(brokerId: BrokerId | "NONE") {
  if (brokerId === "IC_MARKETS") return "IC Markets";
  if (brokerId === "CAPITAL_COM") return "Capital.com";
  return "None";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function AutonomousBrokerOptimizationPanel() {
  const [report, setReport] =
    useState<AutonomousBrokerOptimizationReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/autonomous-broker-optimization", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Autonomous Broker Optimization:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedProfiles = useMemo(() => {
    return [...(report?.optimizationProfiles ?? [])].sort(
      (a, b) => b.recommendedWeight - a.recommendedWeight
    );
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.5.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Autonomous Broker Optimization
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert autonome Broker-Optimierung aus Execution Quality,
            Trend Score, Reliability Score und adaptiver Broker-Gewichtung.
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
          Lade Autonomous Broker Optimization Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Brokers" value={report.totalBrokers} />
            <SummaryCard
              label="Recommended"
              value={getBrokerLabel(report.recommendedBroker)}
            />
            <SummaryCard
              label="Strongest"
              value={getBrokerLabel(report.strongestBroker)}
            />
            <SummaryCard
              label="Weakest"
              value={getBrokerLabel(report.weakestBroker)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <OptimizedWeightCard
              brokerName="IC Markets"
              value={report.optimizedWeights.IC_MARKETS}
            />
            <OptimizedWeightCard
              brokerName="Capital.com"
              value={report.optimizedWeights.CAPITAL_COM}
            />
          </div>

          <div className="space-y-4">
            {rankedProfiles.map((profile, index) => (
              <div
                key={profile.brokerId}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                        Rank #{index + 1}
                      </span>

                      <h3 className="text-xl font-bold text-white">
                        {profile.brokerName}
                      </h3>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                          profile.status
                        )}`}
                      >
                        {profile.status}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getActionClass(
                          profile.recommendedAction
                        )}`}
                      >
                        {profile.recommendedAction}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Current Weight:{" "}
                      <span className="font-bold text-white">
                        {profile.currentNormalizedWeight}%
                      </span>{" "}
                      · Recommended:{" "}
                      <span className="font-bold text-cyan-300">
                        {profile.recommendedWeight}%
                      </span>
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Optimization Confidence
                    </p>
                    <p className="mt-1 text-4xl font-black text-white">
                      {profile.optimizationConfidence}
                    </p>
                  </div>
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-4">
                  <ScoreMetric
                    label="Exec Quality"
                    value={profile.executionQualityScore}
                  />
                  <ScoreMetric label="Trend" value={profile.trendScore} />
                  <ScoreMetric
                    label="Reliability"
                    value={profile.reliabilityScore}
                  />
                  <ScoreMetric
                    label="Adaptive Weight"
                    value={profile.finalAdaptiveWeight}
                  />
                </div>

                <div className="mb-5 grid gap-4 lg:grid-cols-2">
                  <WeightShiftCard
                    label="Current Weight"
                    value={profile.currentNormalizedWeight}
                  />
                  <WeightShiftCard
                    label="Recommended Weight"
                    value={profile.recommendedWeight}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-6">
                  <BrokerMetric
                    label="Latency"
                    value={`${profile.metrics.averageLatencyMs}ms`}
                  />
                  <BrokerMetric
                    label="Spread"
                    value={profile.metrics.averageSpreadPoints}
                  />
                  <BrokerMetric
                    label="Slippage"
                    value={profile.metrics.averageSlippagePoints}
                  />
                  <BrokerMetric
                    label="Fill"
                    value={profile.metrics.averageFillQualityScore}
                  />
                  <BrokerMetric
                    label="Liquidity"
                    value={profile.metrics.averageLiquidityScore}
                  />
                  <BrokerMetric
                    label="Reject Risk"
                    value={profile.metrics.averageRejectionRiskScore}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-bold text-cyan-300">
                    Optimization Reasons
                  </p>

                  <ul className="space-y-2 text-sm text-slate-300">
                    {profile.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white">
                Optimization Notes
              </h3>

              <div className="mt-4 space-y-2">
                {report.optimizationNotes.map((note) => (
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
                  {report.safety.optimizationMode}
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
          Autonomous Broker Optimization Daten konnten nicht geladen werden.
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

function OptimizedWeightCard({
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
        Optimized autonomous broker allocation
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

function ScoreMetric({
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

function WeightShiftCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-bold text-cyan-300">{value}%</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: clampWidth(value) }}
        />
      </div>
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
