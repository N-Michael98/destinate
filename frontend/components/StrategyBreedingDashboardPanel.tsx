"use client";

import { useEffect, useState } from "react";

interface StrategyBreedingEntry {
  hybridId: string;
  parentA: string;
  parentB: string;
  hybridName: string;
  parentAScore: number;
  parentBScore: number;
  hybridScore: number;
  expectedImprovement: number;
  breedingConfidence: number;
  breedingReason: string;
}

interface StrategyBreedingReport {
  version: string;
  status: string;
  totalHybrids: number;
  bestHybrid: string;
  entries: StrategyBreedingEntry[];
  summary: string;
  createdAt: string;
}

export default function StrategyBreedingDashboardPanel() {
  const [report, setReport] =
    useState<StrategyBreedingReport | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response =
          await fetch(
            "/api/strategy-breeding",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        setReport(data.report);

      } catch (error) {
        console.error(
          "Strategy Breeding Error",
          error
        );
      }
    }

    loadData();
  }, []);

  if (!report) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        Loading Strategy Breeding...
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">

      <div className="mb-6 flex items-center justify-between">

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V13.6.1
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Strategy Breeding
          </h2>
        </div>

        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">
          {report.status}
        </span>

      </div>

      <div className="grid gap-4 lg:grid-cols-3">

        <Card
          label="Total Hybrids"
          value={report.totalHybrids}
        />

        <Card
          label="Best Hybrid"
          value={report.bestHybrid}
        />

        <Card
          label="Version"
          value={report.version}
        />

      </div>

      <div className="mt-6 space-y-4">

        {report.entries.map(
          (entry) => (

            <div
              key={entry.hybridId}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
            >

              <div className="flex items-center justify-between">

                <h3 className="font-bold text-white">
                  {entry.hybridName}
                </h3>

                <span className="text-3xl font-black text-cyan-300">
                  {entry.hybridScore}
                </span>

              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-4">

                <Card
                  label="Parent A"
                  value={entry.parentA}
                />

                <Card
                  label="Parent B"
                  value={entry.parentB}
                />

                <Card
                  label="Improvement"
                  value={entry.expectedImprovement}
                />

                <Card
                  label="Confidence"
                  value={entry.breedingConfidence}
                />

              </div>

              <p className="mt-4 text-sm text-slate-400">
                {entry.breedingReason}
              </p>

            </div>

          )
        )}

      </div>

    </section>
  );
}

function Card({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">

      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-bold text-white break-words">
        {value}
      </p>

    </div>
  );
}
