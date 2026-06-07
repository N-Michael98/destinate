"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";

interface BrokerExecutionQualityMemory {
  brokerId: BrokerId;
  brokerName: string;
  totalSamples: number;
  filledSamples: number;
  partialFillSamples: number;
  rejectedSamples: number;
  averageLatencyMs: number;
  averageSpreadPoints: number;
  averageSlippagePoints: number;
  averageFillQualityScore: number;
  averageLiquidityScore: number;
  averageRejectionRiskScore: number;
  executionQualityScore: number;
  learningStatus: "READY" | "LEARNING" | "DEGRADED" | "BLOCKED";
  strengths: string[];
  weaknesses: string[];
}

interface BrokerExecutionQualityLearningReport {
  version: string;
  status: "READY" | "LEARNING" | "DEGRADED" | "BLOCKED";
  mode: string[];
  totalSamples: number;
  brokerMemories: BrokerExecutionQualityMemory[];
  bestBroker: BrokerId | "NONE";
  weakestBroker: BrokerId | "NONE";
  summary: string;
  learningNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    learningMode: "SIMULATED_EXECUTION_QUALITY_MEMORY";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "READY") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "LEARNING") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (status === "DEGRADED") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getBrokerLabel(brokerId: BrokerId | "NONE") {
  if (brokerId === "IC_MARKETS") return "IC Markets";
  if (brokerId === "CAPITAL_COM") return "Capital.com";
  return "None";
}

function getScoreBarWidth(score: number) {
  return `${Math.max(0, Math.min(100, score))}%`;
}

export default function BrokerExecutionQualityLearningPanel() {
  const [report, setReport] =
    useState<BrokerExecutionQualityLearningReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/broker-execution-quality-learning", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Broker Execution Quality Learning:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedBrokers = useMemo(() => {
    return [...(report?.brokerMemories ?? [])].sort(
      (a, b) => b.executionQualityScore - a.executionQualityScore
    );
  }, [report]);

  const metricAverages = useMemo(() => {
    const memories = report?.brokerMemories ?? [];

    if (memories.length === 0) {
      return {
        latency: 0,
        spread: 0,
        slippage: 0,
        fillQuality: 0,
        liquidity: 0,
        rejectionRisk: 0,
      };
    }

    const avg = (selector: (memory: BrokerExecutionQualityMemory) => number) =>
      Math.round(
        memories.reduce((sum, memory) => sum + selector(memory), 0) /
          memories.length
      );

    const avg2 = (selector: (memory: BrokerExecutionQualityMemory) => number) =>
      Math.round(
        (memories.reduce((sum, memory) => sum + selector(memory), 0) /
          memories.length) *
          100
      ) / 100;

    return {
      latency: avg((memory) => memory.averageLatencyMs),
      spread: avg2((memory) => memory.averageSpreadPoints),
      slippage: avg2((memory) => memory.averageSlippagePoints),
      fillQuality: avg((memory) => memory.averageFillQualityScore),
      liquidity: avg((memory) => memory.averageLiquidityScore),
      rejectionRisk: avg((memory) => memory.averageRejectionRiskScore),
    };
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.3.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Broker Execution Quality Learning
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert simulierte Broker-Learning-Memory aus Latency, Spread,
            Slippage, Fill Quality, Liquidity und Rejection Risk.
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
          Lade Broker Execution Quality Learning Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Samples" value={report.totalSamples} />
            <SummaryCard
              label="Best Broker"
              value={getBrokerLabel(report.bestBroker)}
            />
            <SummaryCard
              label="Weakest Broker"
              value={getBrokerLabel(report.weakestBroker)}
            />
            <SummaryCard
              label="Learning Mode"
              value={report.safety.learningMode}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <MetricAverageCard
              label="Avg Latency"
              value={`${metricAverages.latency}ms`}
              description="Lower is better"
            />
            <MetricAverageCard
              label="Avg Spread"
              value={metricAverages.spread}
              description="Lower is better"
            />
            <MetricAverageCard
              label="Avg Slippage"
              value={metricAverages.slippage}
              description="Lower is better"
            />
            <MetricAverageCard
              label="Avg Fill Quality"
              value={metricAverages.fillQuality}
              description="Higher is better"
            />
            <MetricAverageCard
              label="Avg Liquidity"
              value={metricAverages.liquidity}
              description="Higher is better"
            />
            <MetricAverageCard
              label="Avg Rejection Risk"
              value={metricAverages.rejectionRisk}
              description="Lower is better"
            />
          </div>

          <div className="space-y-4">
            {rankedBrokers.map((broker, index) => (
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
                          broker.learningStatus
                        )}`}
                      >
                        {broker.learningStatus}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Samples:{" "}
                      <span className="font-bold text-white">
                        {broker.totalSamples}
                      </span>{" "}
                      · Filled:{" "}
                      <span className="font-bold text-emerald-300">
                        {broker.filledSamples}
                      </span>{" "}
                      · Rejected:{" "}
                      <span className="font-bold text-red-300">
                        {broker.rejectedSamples}
                      </span>
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Quality Score
                    </p>
                    <p className="mt-1 text-4xl font-black text-white">
                      {broker.executionQualityScore}
                    </p>
                  </div>
                </div>

                <div className="mb-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{
                      width: getScoreBarWidth(broker.executionQualityScore),
                    }}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-6">
                  <BrokerMetric
                    label="Latency"
                    value={`${broker.averageLatencyMs}ms`}
                  />
                  <BrokerMetric
                    label="Spread"
                    value={broker.averageSpreadPoints}
                  />
                  <BrokerMetric
                    label="Slippage"
                    value={broker.averageSlippagePoints}
                  />
                  <BrokerMetric
                    label="Fill"
                    value={broker.averageFillQualityScore}
                  />
                  <BrokerMetric
                    label="Liquidity"
                    value={broker.averageLiquidityScore}
                  />
                  <BrokerMetric
                    label="Reject Risk"
                    value={broker.averageRejectionRiskScore}
                  />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <NotesBox
                    title="Strengths"
                    emptyText="No clear strengths detected yet."
                    items={broker.strengths}
                    tone="positive"
                  />

                  <NotesBox
                    title="Weaknesses"
                    emptyText="No major weaknesses detected."
                    items={broker.weaknesses}
                    tone="warning"
                  />
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
                  {report.safety.learningMode}
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
          Broker Execution Quality Learning Daten konnten nicht geladen werden.
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

function MetricAverageCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black text-cyan-300">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
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

function NotesBox({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: "positive" | "warning";
}) {
  const titleClass =
    tone === "positive" ? "text-emerald-300" : "text-yellow-300";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className={`mb-3 text-sm font-bold ${titleClass}`}>{title}</p>

      {items.length > 0 ? (
        <ul className="space-y-2 text-sm text-slate-300">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}
