"use client";

import { useEffect, useState } from "react";

type SyncItem = {
  species: string;
  evolutionAllocation: number;
  portfolioWeight: number;
  syncImpact: string;
  portfolioRole: string;
};

type SyncReport = {
  version: string;
  status: string;
  mode: string;
  source: string;
  target: string;
  totalSyncedAllocation: number;
  totalPortfolioWeight: number;
  syncedItems: SyncItem[];
  dominantPortfolioSpecies: string;
  blockedSpecies: string[];
  summary: string;
};

export default function EvolutionAllocationPortfolioSyncPanel() {
  const [report, setReport] = useState<SyncReport | null>(null);

  useEffect(() => {
    fetch("/api/evolution-allocation-portfolio-sync")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-black/40 p-5 shadow-lg shadow-emerald-500/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-emerald-300">
            Evolution Allocation Portfolio Sync
          </h2>
          <p className="text-sm text-zinc-400">
            V14.3.1 Dashboard Panel · Evolution → Portfolio Brain
          </p>
        </div>

        <div className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-sm text-zinc-400">Loading sync report...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Total Allocation</p>
              <p className="text-xl font-bold text-white">
                {report.totalSyncedAllocation}%
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Portfolio Weight</p>
              <p className="text-xl font-bold text-white">
                {report.totalPortfolioWeight}%
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Dominant Species</p>
              <p className="text-xl font-bold text-emerald-300">
                {report.dominantPortfolioSpecies}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Blocked</p>
              <p className="text-xl font-bold text-red-300">
                {report.blockedSpecies.length}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.syncedItems.map((item) => (
              <div
                key={item.species}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{item.species}</p>
                    <p className="text-xs text-zinc-500">{item.portfolioRole}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-emerald-300">
                      {item.portfolioWeight}%
                    </p>
                    <p className="text-xs text-zinc-500">{item.syncImpact}</p>
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${item.portfolioWeight}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="rounded-xl bg-emerald-950/30 p-3 text-sm text-emerald-200">
            {report.summary}
          </p>
        </div>
      )}
    </section>
  );
}
