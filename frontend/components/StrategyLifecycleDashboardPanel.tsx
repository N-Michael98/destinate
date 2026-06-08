"use client";

import { useEffect, useMemo, useState } from "react";

type StrategyLifecycleStatus =
  | "PROMOTED"
  | "ACTIVE"
  | "WATCHLIST"
  | "DEGRADED"
  | "ARCHIVED";

interface StrategyLifecycleEntry {
  strategyId: string;
  strategyName: string;
  symbol: string;
  market: string;
  lifecycleStatus: StrategyLifecycleStatus;
  lifecycleScore: number;
  competitionScore: number;
  decisionConfidence: number;
  reason: string;
}

interface StrategyLifecycleReport {
  version: string;
  status: string;
  totalStrategies: number;
  promotedStrategies: number;
  activeStrategies: number;
  watchlistStrategies: number;
  degradedStrategies: number;
  archivedStrategies: number;
  entries: StrategyLifecycleEntry[];
  summary: string;
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "PROMOTED") {
    return "border-purple-500/40 bg-purple-500/10 text-purple-300";
  }

  if (status === "ACTIVE" || status === "READY") {
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

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function StrategyLifecycleDashboardPanel() {
  const [report, setReport] = useState<StrategyLifecycleReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/strategy-lifecycle", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Strategy Lifecycle:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedEntries = useMemo(() => {
    return [...(report?.entries ?? [])].sort(
      (a, b) => b.lifecycleScore - a.lifecycleScore
    );
  }, [report]);

  const groupedEntries = useMemo(() => {
    const groups: Record<StrategyLifecycleStatus, StrategyLifecycleEntry[]> = {
      PROMOTED: [],
      ACTIVE: [],
      WATCHLIST: [],
      DEGRADED: [],
      ARCHIVED: [],
    };

    for (const entry of report?.entries ?? []) {
      groups[entry.lifecycleStatus].push(entry);
    }

    return groups;
  }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V13.2.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Strategy Lifecycle
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert Promotion, Active Status, Watchlist, Degradation und
            Archivierung von Strategien basierend auf Multi-Strategy
            Competition Ergebnissen.
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
          Lade Strategy Lifecycle Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-6">
            <SummaryCard label="Total" value={report.totalStrategies} />
            <SummaryCard label="Promoted" value={report.promotedStrategies} />
            <SummaryCard label="Active" value={report.activeStrategies} />
            <SummaryCard label="Watchlist" value={report.watchlistStrategies} />
            <SummaryCard label="Degraded" value={report.degradedStrategies} />
            <SummaryCard label="Archived" value={report.archivedStrategies} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {(
              [
                "PROMOTED",
                "ACTIVE",
                "WATCHLIST",
                "DEGRADED",
                "ARCHIVED",
              ] as StrategyLifecycleStatus[]
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
              Lifecycle Ranking
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
                            entry.lifecycleStatus
                          )}`}
                        >
                          {entry.lifecycleStatus}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {entry.market} · {entry.symbol}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Lifecycle Score
                      </p>
                      <p className="mt-1 text-4xl font-black text-white">
                        {entry.lifecycleScore}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: clampWidth(entry.lifecycleScore) }}
                    />
                  </div>

                  <div className="mb-4 grid gap-3 lg:grid-cols-3">
                    <MiniMetric
                      label="Competition"
                      value={entry.competitionScore}
                    />
                    <MiniMetric
                      label="Decision Confidence"
                      value={entry.decisionConfidence}
                    />
                    <MiniMetric label="Reason" value={entry.reason} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold text-white">Lifecycle Summary</h3>
            <p className="mt-3 text-sm text-slate-400">{report.summary}</p>
            <p className="mt-3 text-xs text-slate-500">
              Created: {new Date(report.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Strategy Lifecycle Daten konnten nicht geladen werden.
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
      <p className="mt-3 break-words text-2xl font-black text-white">{value}</p>
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
