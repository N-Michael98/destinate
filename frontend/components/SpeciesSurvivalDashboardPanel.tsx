"use client";

import { useEffect, useMemo, useState } from "react";

type SurvivalStatus =
  | "DOMINANT"
  | "STABLE"
  | "THREATENED"
  | "ENDANGERED";

interface SpeciesSurvivalEntry {
  species: string;
  population: number;
  averageConfidence: number;
  hybridBonus: number;
  survivalScore: number;
  survivalStatus: SurvivalStatus;
  reason: string;
}

interface SpeciesSurvivalReport {
  version: string;
  status: string;
  totalSpecies: number;
  dominantSpecies: string;
  entries: SpeciesSurvivalEntry[];
  summary: string;
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "DOMINANT") {
    return "border-purple-500/40 bg-purple-500/10 text-purple-300";
  }

  if (status === "STABLE") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "THREATENED") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getSpeciesClass(species: string) {
  if (species === "HYBRID") {
    return "border-purple-500/40 bg-purple-500/10 text-purple-300";
  }

  if (species === "LIQUIDITY") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (species === "TREND") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (species === "INSTITUTIONAL") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  if (species === "BREAKOUT") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  }

  if (species === "MEAN_REVERSION") {
    return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  }

  return "border-slate-500/40 bg-slate-500/10 text-slate-300";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function SpeciesSurvivalDashboardPanel() {
  const [report, setReport] =
    useState<SpeciesSurvivalReport | null>(null);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/species-survival",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        setReport(data.report);
      } catch (error) {
        console.error(
          "Species Survival Error",
          error
        );

        setReport(null);
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
            b.survivalScore -
            a.survivalScore
        );
    }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-purple-950/20">

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
            V13.8.1
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Species Survival Engine
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Bewertet welche Strategy Species dominant, stabil, bedroht oder
            gefährdet sind. Grundlage für spätere Species Extinction,
            Species Evolution und Species Dominance.
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
          Lade Species Survival Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">

          <div className="grid gap-4 lg:grid-cols-4">

            <SummaryCard
              label="Total Species"
              value={report.totalSpecies}
            />

            <SummaryCard
              label="Dominant Species"
              value={report.dominantSpecies}
            />

            <SummaryCard
              label="Version"
              value={report.version}
            />

            <SummaryCard
              label="Mode"
              value="Simulation"
            />

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Species Survival Ranking
            </h3>

            <div className="mt-4 space-y-3">

              {rankedEntries.map((entry, index) => (
                <div
                  key={entry.species}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                >

                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                          Rank #{index + 1}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getSpeciesClass(
                            entry.species
                          )}`}
                        >
                          {entry.species}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            entry.survivalStatus
                          )}`}
                        >
                          {entry.survivalStatus}
                        </span>

                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {entry.reason}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">

                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Survival Score
                      </p>

                      <p className="mt-1 text-4xl font-black text-white">
                        {entry.survivalScore}
                      </p>

                    </div>

                  </div>

                  <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">

                    <div
                      className="h-full rounded-full bg-purple-400"
                      style={{
                        width:
                          clampWidth(
                            entry.survivalScore
                          ),
                      }}
                    />

                  </div>

                  <div className="grid gap-3 lg:grid-cols-4">

                    <MiniMetric
                      label="Population"
                      value={entry.population}
                    />

                    <MiniMetric
                      label="Avg Confidence"
                      value={entry.averageConfidence}
                    />

                    <MiniMetric
                      label="Hybrid Bonus"
                      value={entry.hybridBonus}
                    />

                    <MiniMetric
                      label="Status"
                      value={entry.survivalStatus}
                    />

                  </div>

                </div>
              ))}

            </div>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Survival Summary
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              {report.summary}
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Created: {new Date(report.createdAt).toLocaleString()}
            </p>

          </div>

        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Species Survival Daten konnten nicht geladen werden.
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
