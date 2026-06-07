"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";
type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";
type MarketCategory = "GOLD" | "FOREX" | "INDICES" | "CRYPTO" | "COMMODITIES";

interface BrokerMarketStylePerformance {
  brokerId: BrokerId;
  brokerName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  averageRR: number;
  profitFactor: number;
  averagePnlPercent: number;
  maxDrawdownPercent: number;
  executionQualityScore: number;
  reputationScore: number;
  performanceScore: number;
  confidenceScore: number;
  status: "READY" | "PREFERRED" | "NEUTRAL" | "UNDERPERFORMING" | "BLOCKED";
  recommendation: "PREFERRED" | "ACCEPTABLE" | "WATCHLIST" | "AVOID";
  reasons: string[];
}

interface BrokerPerformanceSummary {
  brokerId: BrokerId;
  brokerName: string;
  totalProfiles: number;
  preferredProfiles: number;
  averagePerformanceScore: number;
  averageWinRate: number;
  averageProfitFactor: number;
  bestMarket: MarketCategory;
  bestTradingStyle: TradingStyle;
  status: "READY" | "PREFERRED" | "NEUTRAL" | "UNDERPERFORMING" | "BLOCKED";
}

interface BrokerPerformanceMemoryReport {
  version: string;
  status: "READY" | "PREFERRED" | "NEUTRAL" | "UNDERPERFORMING" | "BLOCKED";
  mode: string[];
  totalProfiles: number;
  preferredBroker: BrokerId | "NONE";
  strongestProfile: string;
  weakestProfile: string;
  performanceProfiles: BrokerMarketStylePerformance[];
  brokerSummaries: BrokerPerformanceSummary[];
  summary: string;
  memoryNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    memoryMode: "SIMULATED_BROKER_PERFORMANCE_MEMORY";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "PREFERRED" || status === "READY") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "NEUTRAL" || status === "WATCHLIST" || status === "ACCEPTABLE") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (status === "UNDERPERFORMING") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
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

export default function BrokerPerformanceMemoryPanel() {
  const [report, setReport] = useState<BrokerPerformanceMemoryReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/broker-performance-memory", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Broker Performance Memory:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedProfiles = useMemo(() => {
    return [...(report?.performanceProfiles ?? [])].sort(
      (a, b) => b.performanceScore - a.performanceScore
    );
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.8.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Broker Performance Memory
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert markt- und tradingstilbezogene Broker Performance
            Memory mit Win Rate, Profit Factor, R:R, Drawdown und Performance
            Score.
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
          Lade Broker Performance Memory Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Profiles" value={report.totalProfiles} />
            <SummaryCard
              label="Preferred Broker"
              value={getBrokerLabel(report.preferredBroker)}
            />
            <SummaryCard label="Strongest Profile" value={report.strongestProfile} />
            <SummaryCard label="Weakest Profile" value={report.weakestProfile} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {report.brokerSummaries.map((summary) => (
              <div
                key={summary.brokerId}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {summary.brokerName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Best:{" "}
                      <span className="font-bold text-cyan-300">
                        {summary.bestMarket} · {summary.bestTradingStyle}
                      </span>
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                      summary.status
                    )}`}
                  >
                    {summary.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MiniMetric
                    label="Avg Score"
                    value={summary.averagePerformanceScore}
                  />
                  <MiniMetric label="Win Rate" value={`${summary.averageWinRate}%`} />
                  <MiniMetric
                    label="Profit Factor"
                    value={summary.averageProfitFactor}
                  />
                  <MiniMetric
                    label="Preferred"
                    value={summary.preferredProfiles}
                  />
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: clampWidth(summary.averagePerformanceScore) }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {rankedProfiles.map((profile, index) => (
              <div
                key={`${profile.brokerId}-${profile.symbol}-${profile.tradingStyle}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                        Rank #{index + 1}
                      </span>

                      <h3 className="text-xl font-bold text-white">
                        {profile.brokerName} · {profile.symbol}
                      </h3>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                          profile.status
                        )}`}
                      >
                        {profile.status}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                          profile.recommendation
                        )}`}
                      >
                        {profile.recommendation}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Market:{" "}
                      <span className="font-bold text-white">{profile.market}</span>{" "}
                      · Style:{" "}
                      <span className="font-bold text-cyan-300">
                        {profile.tradingStyle}
                      </span>{" "}
                      · Trades:{" "}
                      <span className="font-bold text-white">
                        {profile.totalTrades}
                      </span>
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Performance Score
                    </p>
                    <p className="mt-1 text-4xl font-black text-white">
                      {profile.performanceScore}
                    </p>
                  </div>
                </div>

                <div className="mb-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: clampWidth(profile.performanceScore) }}
                  />
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-6">
                  <MiniMetric label="Win Rate" value={`${profile.winRate}%`} />
                  <MiniMetric label="Wins" value={profile.wins} />
                  <MiniMetric label="Losses" value={profile.losses} />
                  <MiniMetric label="Profit Factor" value={profile.profitFactor} />
                  <MiniMetric label="Avg R:R" value={profile.averageRR} />
                  <MiniMetric
                    label="Drawdown"
                    value={`${profile.maxDrawdownPercent}%`}
                  />
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-4">
                  <MiniMetric
                    label="Avg PnL"
                    value={`${profile.averagePnlPercent}%`}
                  />
                  <MiniMetric
                    label="Execution"
                    value={profile.executionQualityScore}
                  />
                  <MiniMetric
                    label="Reputation"
                    value={profile.reputationScore}
                  />
                  <MiniMetric
                    label="Confidence"
                    value={profile.confidenceScore}
                  />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-bold text-cyan-300">
                    Performance Reasons
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
          Broker Performance Memory Daten konnten nicht geladen werden.
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
      <p className="mt-3 break-words text-lg font-black text-white">{value}</p>
    </div>
  );
}

function MiniMetric({
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
