"use client";

import { useEffect, useMemo, useState } from "react";

type GovernanceStatus =
  | "ACTIVE"
  | "PROTECTED"
  | "REDUCED"
  | "ARCHIVED";

interface GovernanceDecision {
  species: string;
  status: GovernanceStatus;
  governanceScore: number;
  reason: string;
}

interface EvolutionGovernanceReport {
  version: string;
  status: string;
  totalSpecies: number;
  activeSpecies: number;
  protectedSpecies: number;
  reducedSpecies: number;
  archivedSpecies: number;
  championSpecies: string;
  decisions: GovernanceDecision[];
  summary: string;
  createdAt: string;
}

function getStatusClass(status: string) {
  if (status === "PROTECTED") {
    return "border-purple-500/40 bg-purple-500/10 text-purple-300";
  }

  if (status === "ACTIVE") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "REDUCED") {
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

export default function EvolutionGovernanceDashboardPanel() {
  const [report, setReport] =
    useState<EvolutionGovernanceReport | null>(null);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/evolution-governance",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        setReport(data.report);
      } catch (error) {
        console.error(
          "Evolution Governance Error",
          error
        );

        setReport(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const rankedDecisions =
    useMemo(() => {
      return [...(report?.decisions ?? [])]
        .sort(
          (a, b) =>
            b.governanceScore -
            a.governanceScore
        );
    }, [report]);

  const groupedDecisions =
    useMemo(() => {
      const groups: Record<GovernanceStatus, GovernanceDecision[]> = {
        PROTECTED: [],
        ACTIVE: [],
        REDUCED: [],
        ARCHIVED: [],
      };

      for (const decision of report?.decisions ?? []) {
        groups[decision.status].push(decision);
      }

      return groups;
    }, [report]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-purple-950/20">

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-400">
            V14.0.1
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Evolution Governance Control Center
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Zentrale Steuerung des Evolution-Ökosystems. Entscheidet, welche
            Strategy Species geschützt, aktiv gehalten, reduziert oder archiviert
            werden.
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
          Lade Evolution Governance Daten...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">

          <div className="grid gap-4 lg:grid-cols-6">

            <SummaryCard
              label="Total Species"
              value={report.totalSpecies}
            />

            <SummaryCard
              label="Champion"
              value={report.championSpecies}
            />

            <SummaryCard
              label="Protected"
              value={report.protectedSpecies}
            />

            <SummaryCard
              label="Active"
              value={report.activeSpecies}
            />

            <SummaryCard
              label="Reduced"
              value={report.reducedSpecies}
            />

            <SummaryCard
              label="Archived"
              value={report.archivedSpecies}
            />

          </div>

          <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5">

            <p className="text-xs uppercase tracking-[0.25em] text-purple-300">
              Champion Species
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">

              <span
                className={`rounded-full border px-4 py-2 text-sm font-black ${getSpeciesClass(
                  report.championSpecies
                )}`}
              >
                {report.championSpecies}
              </span>

              <p className="text-sm text-slate-300">
                Highest evolutionary fitness and protected from extinction.
              </p>

            </div>

          </div>

          <div className="grid gap-4 lg:grid-cols-4">

            {(["PROTECTED", "ACTIVE", "REDUCED", "ARCHIVED"] as GovernanceStatus[]).map(
              (status) => (
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
                      {groupedDecisions[status].length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {groupedDecisions[status].map((decision) => (
                      <div
                        key={`${status}-${decision.species}`}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                      >
                        <p className="text-sm font-bold text-white">
                          {decision.species}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Score {decision.governanceScore}
                        </p>
                      </div>
                    ))}

                    {groupedDecisions[status].length === 0 && (
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
              Governance Ranking
            </h3>

            <div className="mt-4 space-y-3">

              {rankedDecisions.map((decision, index) => (
                <div
                  key={decision.species}
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
                            decision.species
                          )}`}
                        >
                          {decision.species}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            decision.status
                          )}`}
                        >
                          {decision.status}
                        </span>

                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {decision.reason}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">

                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Governance Score
                      </p>

                      <p className="mt-1 text-4xl font-black text-white">
                        {decision.governanceScore}
                      </p>

                    </div>

                  </div>

                  <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-800">

                    <div
                      className="h-full rounded-full bg-purple-400"
                      style={{
                        width:
                          clampWidth(
                            decision.governanceScore
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
              Governance Summary
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
          Evolution Governance Daten konnten nicht geladen werden.
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
