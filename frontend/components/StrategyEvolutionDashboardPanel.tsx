"use client";

import { useEffect, useMemo, useState } from "react";

type StrategyEvolutionStatus =
  | "EVOLVING"
  | "STABLE"
  | "DECLINING"
  | "BREAKTHROUGH";

interface StrategyEvolutionEntry {
  strategyId: string;
  strategyName: string;
  market: string;
  symbol: string;
  lifecycleScore: number;
  competitionScore: number;
  confidenceScore: number;
  evolutionScore: number;
  growthRate: number;
  decayRisk: number;
  projectedFutureScore: number;
  evolutionStatus: StrategyEvolutionStatus;
  reason: string;
}

interface StrategyEvolutionReport {
  version: string;
  status: string;
  totalStrategies: number;
  breakthroughStrategies: number;
  evolvingStrategies: number;
  stableStrategies: number;
  decliningStrategies: number;
  strongestEvolution: string;
  weakestEvolution: string;
  entries: StrategyEvolutionEntry[];
  summary: string;
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "BREAKTHROUGH") {
    return "border-purple-500/40 bg-purple-500/10 text-purple-300";
  }

  if (status === "EVOLVING" || status === "READY") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "STABLE") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function StrategyEvolutionDashboardPanel() {
  const [report, setReport] = useState<StrategyEvolutionReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/strategy-evolution-intelligence", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Strategy Evolution:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedEntries = useMemo(() => {
    return [...(report?.entries ?? [])].sort(
      (a, b) => b.evolutionScore - a.evolutionScore
    );
  }, [report]);

  const groupedEntries = useMemo(() => {
    const groups: Record<StrategyEvolutionStatus, StrategyEvolutionEntry[]> = {
      BREAKTHROUGH: [],
      EVOLVING: [],
      STABLE: [],
      DECLINING: [],
    };

    for (const entry of report?.entries ?? []) {
      groups[entry.evolutionStatus].push(entry);
    }

    return groups;
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V13.3.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Strategy Evolution Intelligence
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert Evolution Score, Growth Rate, Decay Risk und Future
            Projection für Strategien nach Ranking, Competition und Lifecycle.
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
          Lade Strategy Evolution Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-5">
            <SummaryCard label="Total" value={report.totalStrategies} />
            <SummaryCard
              label="Breakthrough"
              value={report.breakthroughStrategies}
            />
            <SummaryCard label="Evolving" value={report.evolvingStrategies} />
            <SummaryCard label="Stable" value={report.stableStrategies} />
            <SummaryCard label="Declining" value={report.decliningStrategies} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryCard
              label="Strongest Evolution"
              value={report.strongestEvolution}
            />
            <SummaryCard
              label="Weakest Evolution"
              value={report.weakestEvolution}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {(
              [
                "BREAKTHROUGH",
                "EVOLVING",
                "STABLE",
                "DECLINING",
              ] as StrategyEvolutionStatus[]
            ).map((status) => (
              <div
                key={status}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                      status
                    )}`}
                  >
                    {status}
                  </span>

                  <span className="text-2xl font-black text-white">
                    {groupedEntries[status].length}
                  </span>
                </div>

                <div className="space-y-2">
                  {groupedEntries[status].slice(0, 3).map((entry) => (
                    <div
                      key={`${status}-${entry.strategyId}-${entry.market}-${entry.symbol}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <p className="text-sm font-bold text-white">
                        {entry.strategyName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.market} · {entry.symbol}
                      </p>
                    </div>
                  ))}

                  {groupedEntries[status].length === 0 && (
                    <p className="text-xs text-slate-500">
                      Keine Strategien in diesem Status.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold text-white">
              Evolution Ranking
            </h3>

            <div className="mt-4 space-y-3">
              {rankedEntries.map((entry, index) => (
                <div
                  key={`${entry.strategyId}-${entry.market}-${entry.symbol}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                          Rank #{index + 1}
                        </span>

                        <h4 className="font-bold text-white">
                          {entry.strategyName}
                        </h4>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            entry.evolutionStatus
                          )}`}
                        >
                          {entry.evolutionStatus}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {entry.market} · {entry.symbol}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Evolution Score
                      </p>
                      <p className="mt-1 text-4xl font-black text-white">
                        {entry.evolutionScore}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: clampWidth(entry.evolutionScore) }}
                    />
                  </div>

                  <div className="mb-4 grid gap-3 lg:grid-cols-6">
                    <MiniMetric label="Lifecycle" value={entry.lifecycleScore} />
                    <MiniMetric
                      label="Competition"
                      value={entry.competitionScore}
                    />
                    <MiniMetric
                      label="Confidence"
                      value={entry.confidenceScore}
                    />
                    <MiniMetric label="Growth Rate" value={`${entry.growthRate}%`} />
                    <MiniMetric label="Decay Risk" value={`${entry.decayRisk}%`} />
                    <MiniMetric
                      label="Future Score"
                      value={entry.projectedFutureScore}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                    {entry.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold text-white">Evolution Summary</h3>
            <p className="mt-3 text-sm text-slate-400">{report.summary}</p>
            <p className="mt-3 text-xs text-slate-500">
              Created: {new Date(report.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Strategy Evolution Daten konnten nicht geladen werden.
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
