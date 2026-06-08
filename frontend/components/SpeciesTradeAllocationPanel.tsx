"use client";

import { useEffect, useState } from "react";

type TradeAllocationItem = {
  species: string;
  allocatedCapitalUsd: number;
  estimatedPositionSizeUsd: number;
  estimatedLotSize: number;
  tradeSlots: number;
  capitalPerTradeUsd: number;
  positionSizePerTradeUsd: number;
  lotSizePerTrade: number;
  executionPermission: string;
  queuePriority: string;
  allocationRole: string;
};

type TradeAllocationReport = {
  version: string;
  status: string;
  mode: string;
  baseSymbol: string;
  totalTradeSlots: number;
  activeTradeSlots: number;
  totalAllocatedCapitalUsd: number;
  totalEstimatedPositionSizeUsd: number;
  totalEstimatedLotSize: number;
  tradeAllocationItems: TradeAllocationItem[];
  primaryTradeSpecies: string;
  blockedSpecies: string[];
  summary: string;
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SpeciesTradeAllocationPanel() {
  const [report, setReport] = useState<TradeAllocationReport | null>(null);

  useEffect(() => {
    fetch("/api/species-trade-allocation")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-purple-500/30 bg-black/40 p-5 shadow-lg shadow-purple-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-purple-300">
            Species Trade Allocation
          </h2>
          <p className="text-sm text-zinc-400">
            V14.6.1 Dashboard Panel · Trade Slots & Queue Priority
          </p>
        </div>

        <div className="rounded-full border border-purple-500/40 px-3 py-1 text-xs font-semibold text-purple-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading trade allocation...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Trade Slots</p>
              <p className="text-lg font-bold text-white">
                {report.totalTradeSlots}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Active Slots</p>
              <p className="text-lg font-bold text-purple-300">
                {report.activeTradeSlots}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Primary Species</p>
              <p className="text-lg font-bold text-purple-300">
                {report.primaryTradeSpecies}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Total Capital</p>
              <p className="text-lg font-bold text-white">
                {usd(report.totalAllocatedCapitalUsd)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.tradeAllocationItems.map((item) => (
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
                      {item.allocationRole}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-purple-300">
                      {item.queuePriority}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {item.executionPermission}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Slots</p>
                    <p className="font-semibold text-white">
                      {item.tradeSlots}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Capital/Trade</p>
                    <p className="font-semibold text-white">
                      {usd(item.capitalPerTradeUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Position/Trade</p>
                    <p className="font-semibold text-white">
                      {usd(item.positionSizePerTradeUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Lot/Trade</p>
                    <p className="font-semibold text-white">
                      {item.lotSizePerTrade}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-purple-950/30 p-3 text-sm text-purple-200">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}
