"use client";

import { useEffect, useMemo, useState } from "react";

type BrokerId = "CAPITAL_COM" | "IC_MARKETS";
type TradingStyle = "SCALPING" | "DAYTRADING" | "SWING";
type MarketCategory = "GOLD" | "FOREX" | "INDICES" | "CRYPTO" | "COMMODITIES";

interface StrategyBrokerMatchProfile {
  id: string;
  strategyType: string;
  strategyName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  brokerId: BrokerId;
  brokerName: string;
  brokerPerformanceScore: number;
  brokerConfidenceScore: number;
  strategySuccessRate: number;
  strategyProfitFactor: number;
  strategyDrawdownPercent: number;
  brokerSuitabilityScore: number;
  finalMatchScore: number;
  status: "READY" | "MATCHED" | "WATCHLIST" | "BLOCKED";
  recommendation: "BEST_MATCH" | "GOOD_MATCH" | "WATCHLIST" | "AVOID";
  reasons: string[];
}

interface StrategyBrokerRecommendation {
  strategyType: string;
  strategyName: string;
  market: MarketCategory;
  symbol: string;
  tradingStyle: TradingStyle;
  preferredBroker: BrokerId | "NONE";
  preferredBrokerName: string;
  bestMatchScore: number;
  alternativeBroker: BrokerId | "NONE";
  alternativeBrokerName: string;
  alternativeMatchScore: number;
  recommendationReason: string;
}

interface StrategyBrokerIntelligenceReport {
  version: string;
  status: "READY" | "MATCHED" | "WATCHLIST" | "BLOCKED";
  mode: string[];
  totalMatches: number;
  totalRecommendations: number;
  strongestMatch: string;
  weakestMatch: string;
  matchProfiles: StrategyBrokerMatchProfile[];
  recommendations: StrategyBrokerRecommendation[];
  summary: string;
  intelligenceNotes: string[];
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: "READ_ONLY";
    intelligenceMode: "SIMULATED_STRATEGY_BROKER_MATCHING";
  };
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "MATCHED" || status === "READY" || status === "BEST_MATCH") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "GOOD_MATCH") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (status === "WATCHLIST") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function StrategyBrokerIntelligencePanel() {
  const [report, setReport] = useState<StrategyBrokerIntelligenceReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/strategy-broker-intelligence", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Strategy Broker Intelligence:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedMatches = useMemo(() => {
    return [...(report?.matchProfiles ?? [])].sort(
      (a, b) => b.finalMatchScore - a.finalMatchScore
    );
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V12.9.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Strategy ↔ Broker Intelligence
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Verbindet Strategie, Markt, Trading Style und Broker Performance
            Memory zu datenbasierten Broker-Empfehlungen pro Strategie.
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
          Lade Strategy Broker Intelligence Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Matches" value={report.totalMatches} />
            <SummaryCard
              label="Recommendations"
              value={report.totalRecommendations}
            />
            <SummaryCard label="Strongest Match" value={report.strongestMatch} />
            <SummaryCard label="Weakest Match" value={report.weakestMatch} />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">
              Strategy Recommendations
            </h3>

            <div className="grid gap-4 lg:grid-cols-2">
              {report.recommendations.map((recommendation) => (
                <div
                  key={`${recommendation.strategyType}-${recommendation.symbol}-${recommendation.tradingStyle}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-white">
                        {recommendation.strategyName}
                      </h4>

                      <p className="mt-1 text-sm text-slate-400">
                        {recommendation.symbol} · {recommendation.market} ·{" "}
                        <span className="font-bold text-cyan-300">
                          {recommendation.tradingStyle}
                        </span>
                      </p>
                    </div>

                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                      Preferred: {recommendation.preferredBrokerName}
                    </span>
                  </div>

                  <div className="mb-4 grid gap-3 lg:grid-cols-2">
                    <BrokerChoiceCard
                      label="Preferred Broker"
                      brokerName={recommendation.preferredBrokerName}
                      score={recommendation.bestMatchScore}
                    />
                    <BrokerChoiceCard
                      label="Alternative Broker"
                      brokerName={recommendation.alternativeBrokerName}
                      score={recommendation.alternativeMatchScore}
                    />
                  </div>

                  <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                    {recommendation.recommendationReason}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Match Profiles</h3>

            {rankedMatches.map((profile, index) => (
              <div
                key={profile.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                        Rank #{index + 1}
                      </span>

                      <h4 className="text-xl font-bold text-white">
                        {profile.strategyName} → {profile.brokerName}
                      </h4>

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
                      {profile.symbol} · {profile.market} ·{" "}
                      <span className="font-bold text-cyan-300">
                        {profile.tradingStyle}
                      </span>
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Match Score
                    </p>
                    <p className="mt-1 text-4xl font-black text-white">
                      {profile.finalMatchScore}
                    </p>
                  </div>
                </div>

                <div className="mb-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: clampWidth(profile.finalMatchScore) }}
                  />
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-5">
                  <MiniMetric
                    label="Suitability"
                    value={profile.brokerSuitabilityScore}
                  />
                  <MiniMetric
                    label="Broker Perf."
                    value={profile.brokerPerformanceScore}
                  />
                  <MiniMetric
                    label="Broker Conf."
                    value={profile.brokerConfidenceScore}
                  />
                  <MiniMetric
                    label="Success Rate"
                    value={`${profile.strategySuccessRate}%`}
                  />
                  <MiniMetric
                    label="Profit Factor"
                    value={profile.strategyProfitFactor}
                  />
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-3">
                  <MiniMetric
                    label="Strategy DD"
                    value={`${profile.strategyDrawdownPercent}%`}
                  />
                  <MiniMetric label="Market" value={profile.market} />
                  <MiniMetric label="Style" value={profile.tradingStyle} />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-bold text-cyan-300">
                    Match Reasons
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
                Intelligence Notes
              </h3>

              <div className="mt-4 space-y-2">
                {report.intelligenceNotes.map((note) => (
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
                  {report.safety.intelligenceMode}
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
          Strategy Broker Intelligence Daten konnten nicht geladen werden.
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

function BrokerChoiceCard({
  label,
  brokerName,
  score,
}: {
  label: string;
  brokerName: string;
  score: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <span className="text-lg font-black text-cyan-300">{score}</span>
      </div>

      <p className="font-bold text-white">{brokerName}</p>

      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: clampWidth(score) }}
        />
      </div>
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
