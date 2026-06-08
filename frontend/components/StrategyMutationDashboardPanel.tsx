"use client";

import { useEffect, useMemo, useState } from "react";

type MutationType =
  | "AGGRESSIVE"
  | "CONSERVATIVE"
  | "NEWS_FILTERED"
  | "SESSION_FILTERED"
  | "RISK_REDUCED";

interface StrategyMutationEntry {
  mutationId: string;
  parentStrategyId: string;
  parentStrategyName: string;
  mutationType: MutationType;
  originalEvolutionScore: number;
  mutationScore: number;
  projectedImprovement: number;
  riskImpact: number;
  mutationReason: string;
}

interface StrategyMutationReport {
  version: string;
  status: string;
  totalParents: number;
  totalMutations: number;
  bestMutation: string;
  entries: StrategyMutationEntry[];
  summary: string;
  createdAt: string;
}

function getMutationClass(type: MutationType) {
  if (type === "AGGRESSIVE") {
    return "border-red-500/40 bg-red-500/10 text-red-300";
  }

  if (type === "CONSERVATIVE") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (type === "NEWS_FILTERED") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  if (type === "SESSION_FILTERED") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  return "border-purple-500/40 bg-purple-500/10 text-purple-300";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function StrategyMutationDashboardPanel() {
  const [report, setReport] = useState<StrategyMutationReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);

      try {
        const response = await fetch("/api/strategy-mutation", {
          cache: "no-store",
        });

        const data = await response.json();
        setReport(data.report);
      } catch (error) {
        console.error("Failed to load Strategy Mutation:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  const rankedMutations = useMemo(() => {
    const deduped = new Map<string, StrategyMutationEntry>();

    for (const entry of report?.entries ?? []) {
      const existing = deduped.get(entry.mutationId);

      if (!existing || entry.mutationScore > existing.mutationScore) {
        deduped.set(entry.mutationId, entry);
      }
    }

    return Array.from(deduped.values()).sort(
      (a, b) => b.mutationScore - a.mutationScore
    );
  }, [report]);

  const groupedMutations = useMemo(() => {
    const groups: Record<MutationType, StrategyMutationEntry[]> = {
      AGGRESSIVE: [],
      CONSERVATIVE: [],
      NEWS_FILTERED: [],
      SESSION_FILTERED: [],
      RISK_REDUCED: [],
    };

    for (const entry of rankedMutations) {
      groups[entry.mutationType].push(entry);
    }

    return groups;
  }, [rankedMutations]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V13.4.1
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Strategy Mutation Engine
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Visualisiert automatisch erzeugte Strategie-Varianten wie
            aggressive, konservative, news-gefilterte, session-gefilterte und
            risikoreduzierte Mutationen.
          </p>
        </div>

        {report && (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">
            {report.status}
          </span>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
          Lade Strategy Mutation Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Parents" value={report.totalParents} />
            <SummaryCard label="Total Mutations" value={report.totalMutations} />
            <SummaryCard label="Deduped View" value={rankedMutations.length} />
            <SummaryCard label="Best Mutation" value={report.bestMutation} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {(
              [
                "AGGRESSIVE",
                "CONSERVATIVE",
                "NEWS_FILTERED",
                "SESSION_FILTERED",
                "RISK_REDUCED",
              ] as MutationType[]
            ).map((type) => (
              <div
                key={type}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getMutationClass(
                      type
                    )}`}
                  >
                    {type}
                  </span>

                  <span className="text-2xl font-black text-white">
                    {groupedMutations[type].length}
                  </span>
                </div>

                <div className="space-y-2">
                  {groupedMutations[type].slice(0, 3).map((entry) => (
                    <div
                      key={`${type}-${entry.mutationId}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <p className="text-sm font-bold text-white">
                        {entry.parentStrategyName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Score {entry.mutationScore} · Risk Impact{" "}
                        {entry.riskImpact}
                      </p>
                    </div>
                  ))}

                  {groupedMutations[type].length === 0 && (
                    <p className="text-xs text-slate-500">
                      Keine Mutationen in diesem Typ.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold text-white">
              Mutation Ranking
            </h3>

            <div className="mt-4 space-y-3">
              {rankedMutations.map((entry, index) => (
                <div
                  key={entry.mutationId}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                          Rank #{index + 1}
                        </span>

                        <h4 className="font-bold text-white">
                          {entry.parentStrategyName}
                        </h4>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getMutationClass(
                            entry.mutationType
                          )}`}
                        >
                          {entry.mutationType}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        Mutation ID: {entry.mutationId}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Mutation Score
                      </p>
                      <p className="mt-1 text-4xl font-black text-white">
                        {entry.mutationScore}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: clampWidth(entry.mutationScore) }}
                    />
                  </div>

                  <div className="mb-4 grid gap-3 lg:grid-cols-4">
                    <MiniMetric
                      label="Original Evolution"
                      value={entry.originalEvolutionScore}
                    />
                    <MiniMetric
                      label="Projected Improve"
                      value={entry.projectedImprovement}
                    />
                    <MiniMetric label="Risk Impact" value={entry.riskImpact} />
                    <MiniMetric
                      label="Mutation Type"
                      value={entry.mutationType}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                    {entry.mutationReason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold text-white">Mutation Summary</h3>
            <p className="mt-3 text-sm text-slate-400">{report.summary}</p>
            <p className="mt-3 text-xs text-slate-500">
              Created: {new Date(report.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Strategy Mutation Daten konnten nicht geladen werden.
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
