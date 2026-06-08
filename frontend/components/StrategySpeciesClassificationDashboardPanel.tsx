"use client";

import { useEffect, useMemo, useState } from "react";

type StrategySpecies =
  | "TREND"
  | "SCALPING"
  | "SWING"
  | "LIQUIDITY"
  | "INSTITUTIONAL"
  | "MEAN_REVERSION"
  | "BREAKOUT"
  | "HYBRID";

interface StrategySpeciesEntry {
  strategyName: string;
  species: StrategySpecies;
  confidence: number;
  reason: string;
}

interface StrategySpeciesClassificationReport {
  version: string;
  status: string;
  totalStrategies: number;
  speciesCounts: Record<string, number>;
  entries: StrategySpeciesEntry[];
  summary: string;
  createdAt: string;
}

function getSpeciesClass(species: string) {
  if (species === "HYBRID") {
    return "border-purple-500/40 bg-purple-500/10 text-purple-300";
  }

  if (species === "LIQUIDITY") {
    return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  }

  if (species === "TREND" || species === "SWING") {
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

export default function StrategySpeciesClassificationDashboardPanel() {
  const [report, setReport] =
    useState<StrategySpeciesClassificationReport | null>(null);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/strategy-species-classification",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        setReport(data.report);
      } catch (error) {
        console.error(
          "Strategy Species Classification Error",
          error
        );

        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const rankedSpecies =
    useMemo(() => {
      return Object.entries(report?.speciesCounts ?? {})
        .sort((a, b) => b[1] - a[1]);
    }, [report]);

  const rankedEntries =
    useMemo(() => {
      return [...(report?.entries ?? [])]
        .sort((a, b) => b.confidence - a.confidence);
    }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V13.7.1
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Strategy Species Classification
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Klassifiziert Strategien in evolutionäre Familien wie Trend,
            Liquidity, Institutional, Breakout, Mean Reversion und Hybrid.
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
          Lade Strategy Species Classification...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">

          <div className="grid gap-4 lg:grid-cols-3">

            <SummaryCard
              label="Total Strategies"
              value={report.totalStrategies}
            />

            <SummaryCard
              label="Species Types"
              value={rankedSpecies.length}
            />

            <SummaryCard
              label="Version"
              value={report.version}
            />

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Species Distribution
            </h3>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">

              {rankedSpecies.map(([species, count]) => (
                <div
                  key={species}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getSpeciesClass(
                        species
                      )}`}
                    >
                      {species}
                    </span>

                    <span className="text-2xl font-black text-white">
                      {count}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{
                        width:
                          clampWidth(
                            (count / report.totalStrategies) * 100
                          ),
                      }}
                    />
                  </div>
                </div>
              ))}

            </div>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Strategy Species Entries
            </h3>

            <div className="mt-4 space-y-3">

              {rankedEntries.map((entry) => (
                <div
                  key={`${entry.strategyName}-${entry.species}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-white">
                          {entry.strategyName}
                        </h4>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getSpeciesClass(
                            entry.species
                          )}`}
                        >
                          {entry.species}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {entry.reason}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Confidence
                      </p>

                      <p className="mt-1 text-4xl font-black text-white">
                        {entry.confidence}
                      </p>
                    </div>

                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{
                        width:
                          clampWidth(
                            entry.confidence
                          ),
                      }}
                    />
                  </div>
                </div>
              ))}

            </div>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-lg font-bold text-white">
              Classification Summary
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
          Strategy Species Classification Daten konnten nicht geladen werden.
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
