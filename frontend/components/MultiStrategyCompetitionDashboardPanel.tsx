"use client";

import { useEffect, useMemo, useState } from "react";

interface StrategyCompetitor {
  strategyId: string;
  strategyName: string;
  market: string;
  symbol: string;
  tradingStyle: string;
  originalRank: number;
  finalStrategyScore: number;
  winRateScore: number;
  profitFactorScore: number;
  drawdownScore: number;
  marketFitScore: number;
  brokerFitScore: number;
  riskFitScore: number;
  confidenceScore: number;
  competitionScore: number;
  competitionPosition: number;
  status: string;
  recommendation: string;
  reasons: string[];
}

interface MarketStrategyCompetition {
  market: string;
  symbol: string;
  totalCompetitors: number;
  winnerStrategyName: string;
  winnerTradingStyle: string;
  winnerScore: number;
  runnerUpStrategyName: string;
  runnerUpScore: number;
  scoreGap: number;
  decisionConfidence: number;
  status: string;
  competitors: StrategyCompetitor[];
  reasons: string[];
}

interface MultiStrategyCompetitionReport {
  version: string;
  status: string;
  mode: string[];
  totalMarkets: number;
  totalCompetitors: number;
  winnersSelected: number;
  noClearWinnerMarkets: number;
  strongestWinner: string;
  weakestWinner: string;
  competitions: MarketStrategyCompetition[];
  globalTopCompetitors: StrategyCompetitor[];
  summary: string;
  competitionNotes: string[];
  createdAt: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: string;
    competitionMode: string;
  };
}

function getStatusClass(status: string) {
  if (status === "WINNER_SELECTED" || status === "WINNER") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "READY" || status === "VALID" || status === "RUNNER_UP") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (status === "NO_CLEAR_WINNER" || status === "WATCHLIST") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function MultiStrategyCompetitionDashboardPanel() {
  const [report, setReport] =
    useState<MultiStrategyCompetitionReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/multi-strategy-competition", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Multi-Strategy Competition:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const topCompetitors = useMemo(() => {
    return [...(report?.globalTopCompetitors ?? [])].slice(0, 10);
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V13.1.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Multi-Strategy Competition
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert Strategie-Wettbewerbe pro Markt und Symbol. Die Engine
            vergleicht mehrere Strategien, bestimmt Gewinner, Runner-Up,
            Score-Gap und Decision Confidence.
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
          Lade Multi-Strategy Competition Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Markets" value={report.totalMarkets} />
            <SummaryCard
              label="Total Competitors"
              value={report.totalCompetitors}
            />
            <SummaryCard label="Winners" value={report.winnersSelected} />
            <SummaryCard
              label="No Clear Winner"
              value={report.noClearWinnerMarkets}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryCard
              label="Strongest Winner"
              value={report.strongestWinner}
            />
            <SummaryCard label="Weakest Winner" value={report.weakestWinner} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold text-white">
              Global Top Competitors
            </h3>

            <div className="mt-4 space-y-3">
              {topCompetitors.map((competitor) => (
                <div
                  key={`${competitor.strategyId}-${competitor.market}-${competitor.symbol}-${competitor.tradingStyle}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-bold text-white">
                        #{competitor.competitionPosition}{" "}
                        {competitor.strategyName}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {competitor.market} · {competitor.symbol} ·{" "}
                        <span className="font-bold text-cyan-300">
                          {competitor.tradingStyle}
                        </span>
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                        competitor.recommendation
                      )}`}
                    >
                      {competitor.recommendation}
                    </span>
                  </div>

                  <div className="mb-3 grid gap-3 lg:grid-cols-5">
                    <MiniMetric
                      label="Competition"
                      value={competitor.competitionScore}
                    />
                    <MiniMetric
                      label="Strategy"
                      value={competitor.finalStrategyScore}
                    />
                    <MiniMetric label="Broker Fit" value={competitor.brokerFitScore} />
                    <MiniMetric label="Risk Fit" value={competitor.riskFitScore} />
                    <MiniMetric
                      label="Confidence"
                      value={competitor.confidenceScore}
                    />
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: clampWidth(competitor.competitionScore) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">
              Market Competitions
            </h3>

            {report.competitions.map((competition) => (
              <div
                key={`${competition.market}-${competition.symbol}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xl font-bold text-white">
                        {competition.market} · {competition.symbol}
                      </h4>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                          competition.status
                        )}`}
                      >
                        {competition.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Competitors:{" "}
                      <span className="font-bold text-white">
                        {competition.totalCompetitors}
                      </span>{" "}
                      · Decision Confidence:{" "}
                      <span className="font-bold text-cyan-300">
                        {competition.decisionConfidence}
                      </span>
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Winner Score
                    </p>
                    <p className="mt-1 text-4xl font-black text-white">
                      {competition.winnerScore}
                    </p>
                  </div>
                </div>

                <div className="mb-5 grid gap-4 lg:grid-cols-2">
                  <WinnerCard
                    label="Winner"
                    strategyName={competition.winnerStrategyName}
                    style={competition.winnerTradingStyle}
                    score={competition.winnerScore}
                  />
                  <WinnerCard
                    label="Runner-Up"
                    strategyName={competition.runnerUpStrategyName}
                    style="Alternative"
                    score={competition.runnerUpScore}
                  />
                </div>

                <div className="mb-5 grid gap-3 lg:grid-cols-3">
                  <MiniMetric label="Score Gap" value={competition.scoreGap} />
                  <MiniMetric
                    label="Decision Confidence"
                    value={competition.decisionConfidence}
                  />
                  <MiniMetric
                    label="Total Competitors"
                    value={competition.totalCompetitors}
                  />
                </div>

                <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-bold text-cyan-300">
                    Competition Reasons
                  </p>

                  <ul className="space-y-2 text-sm text-slate-300">
                    {competition.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-white">
                    Top Competitors
                  </p>

                  {competition.competitors.slice(0, 5).map((competitor) => (
                    <div
                      key={`${competitor.strategyId}-${competitor.tradingStyle}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-bold text-white">
                            #{competitor.competitionPosition}{" "}
                            {competitor.strategyName}
                          </p>
                          <p className="text-sm text-slate-400">
                            {competitor.tradingStyle} · Original Rank{" "}
                            {competitor.originalRank}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            competitor.recommendation
                          )}`}
                        >
                          {competitor.recommendation}
                        </span>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-5">
                        <MiniMetric
                          label="Competition"
                          value={competitor.competitionScore}
                        />
                        <MiniMetric
                          label="Win Rate"
                          value={competitor.winRateScore}
                        />
                        <MiniMetric
                          label="Profit Factor"
                          value={competitor.profitFactorScore}
                        />
                        <MiniMetric
                          label="Drawdown"
                          value={competitor.drawdownScore}
                        />
                        <MiniMetric
                          label="Confidence"
                          value={competitor.confidenceScore}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h3 className="text-lg font-bold text-white">
                Competition Notes
              </h3>

              <div className="mt-4 space-y-2">
                {report.competitionNotes.map((note) => (
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
                  {report.safety.competitionMode}
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
          Multi-Strategy Competition Daten konnten nicht geladen werden.
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

function WinnerCard({
  label,
  strategyName,
  style,
  score,
}: {
  label: string;
  strategyName: string;
  style: string;
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

      <p className="font-bold text-white">{strategyName}</p>
      <p className="mt-1 text-sm text-slate-400">{style}</p>

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
