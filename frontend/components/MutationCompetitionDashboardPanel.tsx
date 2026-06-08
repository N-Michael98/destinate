"use client";

import { useEffect, useMemo, useState } from "react";

type MutationCompetitionStatus =
  | "CHAMPION"
  | "CONTENDER"
  | "AVERAGE"
  | "ELIMINATED";

interface MutationCompetitionEntry {
  mutationId: string;
  strategyName: string;
  mutationType: string;
  mutationScore: number;
  projectedImprovement: number;
  riskImpact: number;
  competitionScore: number;
  rank: number;
  status: MutationCompetitionStatus;
}

interface MutationCompetitionReport {
  version: string;
  status: string;
  totalCompetitors: number;
  championCount: number;
  contenderCount: number;
  averageCount: number;
  eliminatedCount: number;
  championMutation: string;
  entries: MutationCompetitionEntry[];
  summary: string;
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "CHAMPION") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  if (status === "CONTENDER") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "AVERAGE") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function MutationCompetitionDashboardPanel() {
  const [report, setReport] =
    useState<MutationCompetitionReport | null>(null);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    async function loadData() {

      setLoading(true);

      try {

        const response =
          await fetch(
            "/api/mutation-competition",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        setReport(
          data.report
        );

      } catch (error) {

        console.error(
          "Mutation Competition Error",
          error
        );

      } finally {

        setLoading(false);

      }
    }

    loadData();
  }, []);

  const rankedEntries =
    useMemo(() => {

      return [...(report?.entries ?? [])]
        .sort(
          (a, b) =>
            b.competitionScore -
            a.competitionScore
        );

    }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">

      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V13.5.1
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Mutation Competition
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Live Ranking aller Strategy Mutations.
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
          Lade Mutation Competition...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">

          <div className="grid gap-4 lg:grid-cols-6">
            <SummaryCard
              label="Competitors"
              value={report.totalCompetitors}
            />

            <SummaryCard
              label="Champions"
              value={report.championCount}
            />

            <SummaryCard
              label="Contenders"
              value={report.contenderCount}
            />

            <SummaryCard
              label="Average"
              value={report.averageCount}
            />

            <SummaryCard
              label="Eliminated"
              value={report.eliminatedCount}
            />

            <SummaryCard
              label="Best Mutation"
              value={report.championMutation}
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Mutation Ranking
            </h3>

            <div className="mt-4 space-y-3">

              {rankedEntries.map(
                (entry) => (

                  <div
                    key={entry.mutationId}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                  >

                    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                      <div>

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                            Rank #{entry.rank}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                              entry.status
                            )}`}
                          >
                            {entry.status}
                          </span>

                          <h4 className="font-bold text-white">
                            {entry.strategyName}
                          </h4>

                        </div>

                        <p className="mt-2 text-sm text-slate-400">
                          {entry.mutationType}
                        </p>

                      </div>

                      <div className="text-right">

                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Competition Score
                        </p>

                        <p className="mt-1 text-4xl font-black text-white">
                          {entry.competitionScore}
                        </p>

                      </div>

                    </div>

                    <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">

                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{
                          width:
                            clampWidth(
                              entry.competitionScore
                            ),
                        }}
                      />

                    </div>

                    <div className="grid gap-3 lg:grid-cols-4">

                      <MiniMetric
                        label="Mutation Score"
                        value={entry.mutationScore}
                      />

                      <MiniMetric
                        label="Improvement"
                        value={entry.projectedImprovement}
                      />

                      <MiniMetric
                        label="Risk Impact"
                        value={entry.riskImpact}
                      />

                      <MiniMetric
                        label="Type"
                        value={entry.mutationType}
                      />

                    </div>

                  </div>

                )
              )}

            </div>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Competition Summary
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              {report.summary}
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Created:
              {" "}
              {new Date(
                report.createdAt
              ).toLocaleString()}
            </p>

          </div>

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

      <p className="mt-3 break-words text-xl font-black text-white">
        {value}
      </p>

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

      <p className="mt-1 text-sm font-bold text-white">
        {value}
      </p>

    </div>
  );
}
