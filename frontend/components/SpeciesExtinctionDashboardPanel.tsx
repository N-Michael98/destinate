"use client";

import { useEffect, useMemo, useState } from "react";

type ExtinctionAction =
  | "PROTECTED"
  | "MONITOR"
  | "REDUCE"
  | "ARCHIVE";

interface SpeciesExtinctionEntry {
  species: string;
  survivalStatus: string;
  survivalScore: number;
  extinctionRisk: number;
  action: ExtinctionAction;
  reason: string;
}

interface SpeciesExtinctionReport {
  version: string;
  status: string;
  totalSpecies: number;
  archivedCandidates: number;
  extinctionThreats: number;
  entries: SpeciesExtinctionEntry[];
  summary: string;
  createdAt: string;
}

function getActionClass(action: string) {
  if (action === "PROTECTED") {
    return "border-purple-500/40 bg-purple-500/10 text-purple-300";
  }

  if (action === "MONITOR") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (action === "REDUCE") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function getRiskClass(risk: number) {
  if (risk >= 70) {
    return "text-red-300";
  }

  if (risk >= 40) {
    return "text-yellow-300";
  }

  if (risk >= 15) {
    return "text-cyan-300";
  }

  return "text-emerald-300";
}

function clampWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function SpeciesExtinctionDashboardPanel() {
  const [report, setReport] =
    useState<SpeciesExtinctionReport | null>(null);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/species-extinction",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        setReport(data.report);
      } catch (error) {
        console.error(
          "Species Extinction Error",
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
            b.extinctionRisk -
            a.extinctionRisk
        );
    }, [report]);

  const actionCounts =
    useMemo(() => {
      const counts: Record<ExtinctionAction, number> = {
        PROTECTED: 0,
        MONITOR: 0,
        REDUCE: 0,
        ARCHIVE: 0,
      };

      for (const entry of report?.entries ?? []) {
        counts[entry.action] += 1;
      }

      return counts;
    }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-red-950/20">

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-400">
            V13.9.1
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Species Extinction Engine
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Bewertet Extinction Risk pro Strategy Species und markiert,
            welche Spezies geschützt, überwacht, reduziert oder archiviert
            werden sollen.
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
          Lade Species Extinction Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">

          <div className="grid gap-4 lg:grid-cols-5">

            <SummaryCard
              label="Total Species"
              value={report.totalSpecies}
            />

            <SummaryCard
              label="Threats"
              value={report.extinctionThreats}
            />

            <SummaryCard
              label="Archive Candidates"
              value={report.archivedCandidates}
            />

            <SummaryCard
              label="Protected"
              value={actionCounts.PROTECTED}
            />

            <SummaryCard
              label="Version"
              value={report.version}
            />

          </div>

          <div className="grid gap-4 lg:grid-cols-4">

            {(["PROTECTED", "MONITOR", "REDUCE", "ARCHIVE"] as ExtinctionAction[]).map(
              (action) => (
                <div
                  key={action}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getActionClass(
                        action
                      )}`}
                    >
                      {action}
                    </span>

                    <span className="text-2xl font-black text-white">
                      {actionCounts[action]}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(report.entries ?? [])
                      .filter((entry) => entry.action === action)
                      .map((entry) => (
                        <div
                          key={`${action}-${entry.species}`}
                          className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                        >
                          <p className="text-sm font-bold text-white">
                            {entry.species}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Risk {entry.extinctionRisk} · Survival{" "}
                            {entry.survivalScore}
                          </p>
                        </div>
                      ))}

                    {actionCounts[action] === 0 && (
                      <p className="text-xs text-slate-500">
                        Keine Species in dieser Kategorie.
                      </p>
                    )}
                  </div>
                </div>
              )
            )}

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Extinction Risk Ranking
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
                          Risk Rank #{index + 1}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getActionClass(
                            entry.action
                          )}`}
                        >
                          {entry.action}
                        </span>

                        <h4 className="font-bold text-white">
                          {entry.species}
                        </h4>

                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {entry.reason}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">

                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Extinction Risk
                      </p>

                      <p className={`mt-1 text-4xl font-black ${getRiskClass(entry.extinctionRisk)}`}>
                        {entry.extinctionRisk}
                      </p>

                    </div>

                  </div>

                  <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{
                        width:
                          clampWidth(
                            entry.extinctionRisk
                          ),
                      }}
                    />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-4">

                    <MiniMetric
                      label="Survival Status"
                      value={entry.survivalStatus}
                    />

                    <MiniMetric
                      label="Survival Score"
                      value={entry.survivalScore}
                    />

                    <MiniMetric
                      label="Extinction Risk"
                      value={entry.extinctionRisk}
                    />

                    <MiniMetric
                      label="Action"
                      value={entry.action}
                    />

                  </div>

                </div>
              ))}

            </div>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">

            <h3 className="text-lg font-bold text-white">
              Extinction Summary
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
          Species Extinction Daten konnten nicht geladen werden.
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
