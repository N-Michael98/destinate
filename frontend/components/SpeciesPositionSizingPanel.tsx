"use client";

import { useEffect, useState } from "react";

type SizingItem = {
  species: string;
  allocatedCapitalUsd: number;
  riskPercent: number;
  riskAmountUsd: number;
  stopLossDistancePercent: number;
  estimatedPositionSizeUsd: number;
  estimatedLotSize: number;
  executionPermission: string;
  sizingTier: string;
  sizingRole: string;
};

type SizingReport = {
  version: string;
  status: string;
  mode: string;
  baseSymbol: string;
  totalAllocatedCapitalUsd: number;
  totalRiskAmountUsd: number;
  totalEstimatedPositionSizeUsd: number;
  sizingItems: SizingItem[];
  largestPositionSpecies: string;
  blockedSpecies: string[];
  summary: string;
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SpeciesPositionSizingPanel() {
  const [report, setReport] = useState<SizingReport | null>(null);

  useEffect(() => {
    fetch("/api/species-position-sizing")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-orange-500/30 bg-black/40 p-5 shadow-lg shadow-orange-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-orange-300">
            Species Position Sizing
          </h2>
          <p className="text-sm text-zinc-400">
            V14.5.1 Dashboard Panel · Risk → Position Size → Lot Size
          </p>
        </div>

        <div className="rounded-full border border-orange-500/40 px-3 py-1 text-xs font-semibold text-orange-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading sizing report...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Capital</p>
              <p className="text-lg font-bold text-white">
                {usd(report.totalAllocatedCapitalUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Total Risk</p>
              <p className="text-lg font-bold text-orange-300">
                {usd(report.totalRiskAmountUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Position Size</p>
              <p className="text-lg font-bold text-white">
                {usd(report.totalEstimatedPositionSizeUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Largest Species</p>
              <p className="text-lg font-bold text-orange-300">
                {report.largestPositionSpecies}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.sizingItems.map((item) => (
              <div
                key={item.species}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      {item.species}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {item.sizingRole}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-orange-300">
                      Lot {item.estimatedLotSize}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {item.executionPermission}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Capital</p>
                    <p className="text-sm font-semibold text-white">
                      {usd(item.allocatedCapitalUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Risk</p>
                    <p className="text-sm font-semibold text-white">
                      {usd(item.riskAmountUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Position</p>
                    <p className="text-sm font-semibold text-white">
                      {usd(item.estimatedPositionSizeUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">SL Distance</p>
                    <p className="text-sm font-semibold text-white">
                      {item.stopLossDistancePercent}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-orange-950/30 p-3 text-sm text-orange-200">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}
