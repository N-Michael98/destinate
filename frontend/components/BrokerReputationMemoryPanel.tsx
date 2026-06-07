"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";

type BrokerReputationGrade = "A_PLUS" | "A" | "B" | "C" | "D" | "F";

interface BrokerReputationMemoryItem {
  brokerId: BrokerId;
  brokerName: string;
  reputationScore: number;
  reputationGrade: BrokerReputationGrade;
  status: "READY" | "TRUSTED" | "WATCHLIST" | "DEGRADED" | "BLOCKED";
  executionTrustScore: number;
  reliabilityTrustScore: number;
  optimizationTrustScore: number;
  allocationTrustScore: number;
  longTermBrokerGrade: BrokerReputationGrade;
  recommendedLongTermWeight: number;
  currentOptimizedWeight: number;
  memoryStrength: number;
  reasons: string[];
  memorySignals: {
    executionQualityScore: number;
    trendScore: number;
    reliabilityScore: number;
    optimizationConfidence: number;
    currentNormalizedWeight: number;
    recommendedWeight: number;
    totalSamples: number;
    averageLatencyMs: number;
    averageSpreadPoints: number;
    averageSlippagePoints: number;
    averageFillQualityScore: number;
    averageLiquidityScore: number;
    averageRejectionRiskScore: number;
  };
}

interface BrokerReputationMemoryReport {
  version: string;
  status: "READY" | "TRUSTED" | "WATCHLIST" | "DEGRADED" | "BLOCKED";
  mode: string[];
  totalBrokers: number;
  topReputationBroker: BrokerId | "NONE";
  weakestReputationBroker: BrokerId | "NONE";
  reputationMemories: BrokerReputationMemoryItem[];
  longTermRecommendedWeights: Record<BrokerId, number>;
  summary: string;
  memoryNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    memoryMode: "SIMULATED_BROKER_REPUTATION_MEMORY";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "TRUSTED" || status === "READY") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "WATCHLIST") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  if (status === "DEGRADED") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getBrokerLabel(brokerId: BrokerId | "NONE") {
  if (brokerId === "IC_MARKETS") return "IC Markets";
  if (brokerId === "CAPITAL_COM") return "Capital.com";
  return "None";
}

function formatGrade(grade: BrokerReputationGrade) {
  if (grade === "A_PLUS") return "A+";
  return grade;
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function BrokerReputationMemoryPanel() {
  const [report, setReport] = useState<BrokerReputationMemoryReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/broker-reputation-memory", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Broker Reputation Memory:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedMemories = useMemo(() => {
    return [...(report?.reputationMemories ?? [])].sort(
      (a, b) => b.reputationScore - a.reputationScore
    );
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.6.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Broker Reputation Memory
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert langfristige Broker-Reputation aus Execution Trust,
            Reliability Trust, Optimization Trust, Allocation Trust und Memory
            Strength.
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
          Lade Broker Reputation Memory Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Brokers" value={report.totalBrokers} />
            <SummaryCard
              label="Top Reputation"
              value={getBrokerLabel(report.topReputationBroker)}
            />
            <SummaryCard
              label="Weakest Reputation"
              value={getBrokerLabel(report.weakestReputationBroker)}
            />
            <SummaryCard label="Memory Mode" value={report.safety.memoryMode} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <LongTermWeightCard
              brokerName="IC Markets"
              value={report.longTermRecommendedWeights.IC_MARKETS}
            />
            <LongTermWeightCard
              brokerName="Capital.com"
              value={report.longTermRecommendedWeights.CAPITAL_COM}
            />
          </div>

          <div className="space-y-4">
            {rankedMemories.map((memory, index) => (
              <div
                key={memory.brokerId}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                        Rank #{index + 1}
                      </span>

                      <h3 className="text-xl font-bold text-white">
                        {memory.brokerName}
                      </h3>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                          memory.status
                        )}`}
                      >
                        {memory.status}
                      </span>

                      <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                        Grade {formatGrade(memory.reputationGrade)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Current Weight:{" "}
                      <span className="font-bold text-white">
                        {memory.currentOptimizedWeight}
                      </span>{" "}
                      · Long-Term Weight:{" "}
                      <span className="font-bold text-cyan-300">
                        {memory.recommendedLongTermWeight}
                      </span>{" "}
                      · Memory Strength:{" "}
                      <span className="font-bold text-emerald-300">
                        {memory.memoryStrength}
                      </span>
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Reputation Score
                    </p>
                    <p className="mt-1 text-4xl font-black text-white">
                      {memory.reputationScore}
                    </p>
                  </div>
                </div>

                <div className="mb-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: clampWidth(memory.reputationScore) }}
                  />
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-4">
                  <TrustMetric
                    label="Execution Trust"
                    value={memory.executionTrustScore}
                  />
                  <TrustMetric
                    label="Reliability Trust"
                    value={memory.reliabilityTrustScore}
                  />
                  <TrustMetric
                    label="Optimization Trust"
                    value={memory.optimizationTrustScore}
                  />
                  <TrustMetric
                    label="Allocation Trust"
                    value={memory.allocationTrustScore}
                  />
                </div>

                <div className="mb-5 grid gap-4 lg:grid-cols-2">
                  <WeightCard
                    label="Current Optimized Weight"
                    value={memory.currentOptimizedWeight}
                  />
                  <WeightCard
                    label="Recommended Long-Term Weight"
                    value={memory.recommendedLongTermWeight}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-6">
                  <SignalMetric
                    label="Exec Quality"
                    value={memory.memorySignals.executionQualityScore}
                  />
                  <SignalMetric
                    label="Trend"
                    value={memory.memorySignals.trendScore}
                  />
                  <SignalMetric
                    label="Reliability"
                    value={memory.memorySignals.reliabilityScore}
                  />
                  <SignalMetric
                    label="Confidence"
                    value={memory.memorySignals.optimizationConfidence}
                  />
                  <SignalMetric
                    label="Latency"
                    value={`${memory.memorySignals.averageLatencyMs}ms`}
                  />
                  <SignalMetric
                    label="Slippage"
                    value={memory.memorySignals.averageSlippagePoints}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-bold text-cyan-300">
                    Reputation Reasons
                  </p>

                  <ul className="space-y-2 text-sm text-slate-300">
                    {memory.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white">Memory Notes</h3>

              <div className="mt-4 space-y-2">
                {report.memoryNotes.map((note) => (
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
                  {report.safety.memoryMode}
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
          Broker Reputation Memory Daten konnten nicht geladen werden.
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

function LongTermWeightCard({
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
        Normalized long-term reputation allocation
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

function TrustMetric({
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

function WeightCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-bold text-cyan-300">{value}</span>
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

function SignalMetric({
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
