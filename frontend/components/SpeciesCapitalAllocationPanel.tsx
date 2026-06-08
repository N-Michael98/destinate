"use client";

import { useEffect, useState } from "react";

type CapitalAllocationItem = {
  species: string;
  portfolioWeight: number;
  allocatedCapitalUsd: number;
  capitalTier: string;
  executionPermission: string;
  capitalRole: string;
};

type CapitalAllocationReport = {
  version: string;
  status: string;
  mode: string;
  portfolioCapitalUsd: number;
  totalAllocatedCapitalUsd: number;
  unallocatedCapitalUsd: number;
  allocationItems: CapitalAllocationItem[];
  dominantCapitalSpecies: string;
  blockedSpecies: string[];
  summary: string;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SpeciesCapitalAllocationPanel() {
  const [report, setReport] = useState<CapitalAllocationReport | null>(null);

  useEffect(() => {
    fetch("/api/species-capital-allocation")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  const enabledCount =
    report?.allocationItems.filter(
      (item) => item.executionPermission === "ENABLED"
    ).length ?? 0;

  return (
    <section className="rounded-2xl border border-cyan-500/30 bg-black/40 p-5 shadow-lg shadow-cyan-500/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-cyan-300">
            Species Capital Allocation
          </h2>
          <p className="text-sm text-zinc-400">
            V14.4.1 Dashboard Panel · Portfolio Weight → Capital
          </p>
        </div>

        <div className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs font-semibold text-cyan-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-sm text-zinc-400">Loading capital allocation...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Portfolio Capital</p>
              <p className="text-xl font-bold text-white">
                {formatUsd(report.portfolioCapitalUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Allocated</p>
              <p className="text-xl font-bold text-cyan-300">
                {formatUsd(report.totalAllocatedCapitalUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Dominant Species</p>
              <p className="text-xl font-bold text-cyan-300">
                {report.dominantCapitalSpecies}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Execution Enabled</p>
              <p className="text-xl font-bold text-white">{enabledCount}</p>
            </div>
          </div>

          <div className="space-y-2">
            {report.allocationItems.map((item) => (
              <div
                key={item.species}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.species}</p>
                    <p className="text-xs text-zinc-500">{item.capitalRole}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-cyan-300">
                      {formatUsd(item.allocatedCapitalUsd)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.portfolioWeight}% · {item.capitalTier} ·{" "}
                      {item.executionPermission}
                    </p>
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${item.portfolioWeight}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Unallocated Capital</p>
              <p className="text-lg font-bold text-white">
                {formatUsd(report.unallocatedCapitalUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Blocked Species</p>
              <p className="text-lg font-bold text-red-300">
                {report.blockedSpecies.join(", ") || "NONE"}
              </p>
            </div>
          </div>

          <p className="rounded-xl bg-cyan-950/30 p-3 text-sm text-cyan-200">
            {report.summary}
          </p>
        </div>
      )}
    </section>
  );
}
