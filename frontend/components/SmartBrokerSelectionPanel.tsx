"use client";

import { useEffect, useMemo, useState } from "react";

type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";

interface BrokerScore {
  brokerId: BrokerId;
  brokerName: string;
  finalScore: number;
  status: string;
  allocationPercent: number;
  reasons: string[];
  metrics: {
    healthScore: number;
    riskScore: number;
    latencyMs: number;
    latencyScore: number;
    spreadScore: number;
    liquidityScore: number;
    executionQualityScore: number;
    leverageScore: number;
  };
}

interface SmartBrokerSelectionReport {
  version: string;
  status: string;
  mode: string[];
  selectedBroker: BrokerId | "MIXED" | "NONE";
  tradingStyleContext: TradingStyle;
  totalBrokersChecked: number;
  brokerScores: BrokerScore[];
  recommendedAllocation: Record<BrokerId, number>;
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
  };
  createdAt: string;
}

const tradingStyles: TradingStyle[] = ["SCALPING", "DAYTRADING", "SWING"];

function getStatusClass(status: string) {
  if (status === "READY" || status === "APPROVED") {
    return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  }

  if (status === "DEGRADED") {
    return "text-yellow-400 border-yellow-500/40 bg-yellow-500/10";
  }

  return "text-red-400 border-red-500/40 bg-red-500/10";
}

function getBrokerLabel(brokerId: string) {
  if (brokerId === "IC_MARKETS") return "IC Markets";
  if (brokerId === "CAPITAL_COM") return "Capital.com";
  return brokerId;
}

export default function SmartBrokerSelectionPanel() {
  const [selectedStyle, setSelectedStyle] = useState<TradingStyle>("SCALPING");
  const [report, setReport] = useState<SmartBrokerSelectionReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/smart-broker-selection?style=${selectedStyle}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Smart Broker Selection report:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [selectedStyle]);

  const sortedBrokers = useMemo(() => {
    return [...(report?.brokerScores ?? [])].sort(
      (a, b) => b.finalScore - a.finalScore
    );
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.1.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Smart Broker Selection
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Dynamische Broker-Auswahl anhand von Health, Risk, Latency, Spread,
            Liquidity, Execution Quality und Leverage.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tradingStyles.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                selectedStyle === style
                  ? "border-cyan-400 bg-cyan-400 text-slate-950"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500"
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
          Lade Smart Broker Selection Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Status
              </p>
              <p
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${getStatusClass(
                  report.status
                )}`}
              >
                {report.status}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Selected Broker
              </p>
              <p className="mt-3 text-xl font-bold text-white">
                {report.selectedBroker === "MIXED"
                  ? "MIXED"
                  : getBrokerLabel(report.selectedBroker)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Trading Style
              </p>
              <p className="mt-3 text-xl font-bold text-cyan-300">
                {report.tradingStyleContext}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Brokers Checked
              </p>
              <p className="mt-3 text-xl font-bold text-white">
                {report.totalBrokersChecked}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sortedBrokers.map((broker) => (
              <div
                key={broker.brokerId}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {broker.brokerName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Allocation:{" "}
                      <span className="font-bold text-cyan-300">
                        {broker.allocationPercent}%
                      </span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-3xl font-black text-white">
                      {broker.finalScore}
                    </p>
                    <p
                      className={`mt-2 rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                        broker.status
                      )}`}
                    >
                      {broker.status}
                    </p>
                  </div>
                </div>

                <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${broker.allocationPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Health" value={broker.metrics.healthScore} />
                  <Metric label="Risk" value={broker.metrics.riskScore} />
                  <Metric label="Latency" value={`${broker.metrics.latencyMs}ms`} />
                  <Metric label="Spread" value={broker.metrics.spreadScore} />
                  <Metric label="Liquidity" value={broker.metrics.liquidityScore} />
                  <Metric
                    label="Execution"
                    value={broker.metrics.executionQualityScore}
                  />
                  <Metric label="Leverage" value={broker.metrics.leverageScore} />
                  <Metric label="Latency Score" value={broker.metrics.latencyScore} />
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Reasons
                  </p>
                  <ul className="space-y-1 text-xs text-slate-300">
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
              <h3 className="text-lg font-bold text-white">
                Recommended Allocation
              </h3>

              <div className="mt-4 space-y-4">
                <AllocationBar
                  label="IC Markets"
                  value={report.recommendedAllocation.IC_MARKETS}
                />
                <AllocationBar
                  label="Capital.com"
                  value={report.recommendedAllocation.CAPITAL_COM}
                />
              </div>
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

              <p className="mt-4 text-sm text-slate-400">{report.summary}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Smart Broker Selection Daten konnten nicht geladen werden.
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function AllocationBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-bold text-cyan-300">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
