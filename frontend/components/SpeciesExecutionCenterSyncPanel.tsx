"use client";

import { useEffect, useState } from "react";

type SyncTicket = {
  sourceTicketId: string;
  executionCenterTicketId: string;
  species: string;
  queuePriority: string;
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  ticketStatus: string;
  destination: string;
};

type SyncReport = {
  version: string;
  status: string;
  mode: string;
  source: string;
  target: string;
  symbol: string;
  totalSourceTickets: number;
  totalSyncedTickets: number;
  readySyncedTickets: number;
  limitedSyncedTickets: number;
  blockedSyncedTickets: number;
  totalSyncedCapitalUsd: number;
  totalSyncedPositionSizeUsd: number;
  totalSyncedLotSize: number;
  primarySpecies: string;
  syncTickets: SyncTicket[];
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

export default function SpeciesExecutionCenterSyncPanel() {
  const [report, setReport] = useState<SyncReport | null>(null);

  useEffect(() => {
    fetch("/api/species-execution-center-sync")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-cyan-500/30 bg-black/40 p-5 shadow-lg shadow-cyan-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-cyan-300">
            Species Execution Center Sync
          </h2>
          <p className="text-sm text-zinc-400">
            V14.8.1 Dashboard Panel · Evolution → Execution Center
          </p>
        </div>

        <div className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-semibold text-cyan-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading execution center sync...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Synced Tickets</p>
              <p className="text-lg font-bold text-white">
                {report.totalSyncedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Ready</p>
              <p className="text-lg font-bold text-green-400">
                {report.readySyncedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Limited</p>
              <p className="text-lg font-bold text-yellow-400">
                {report.limitedSyncedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Target</p>
              <p className="text-sm font-bold text-cyan-300">
                {report.target}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Primary Species</p>
              <p className="text-lg font-bold text-cyan-300">
                {report.primarySpecies}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Capital</p>
              <p className="text-lg font-bold text-white">
                {usd(report.totalSyncedCapitalUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Position Size</p>
              <p className="text-lg font-bold text-white">
                {usd(report.totalSyncedPositionSizeUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Lot Size</p>
              <p className="text-lg font-bold text-cyan-300">
                {report.totalSyncedLotSize}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.syncTickets.map((ticket) => (
              <div
                key={ticket.executionCenterTicketId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      #{ticket.executionRank} · {ticket.executionCenterTicketId}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.sourceTicketId}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-cyan-300">
                      {ticket.species}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.queuePriority}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Status</p>
                    <p className="font-semibold text-white">
                      {ticket.ticketStatus}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Capital</p>
                    <p className="font-semibold text-white">
                      {usd(ticket.capitalUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Lot</p>
                    <p className="font-semibold text-white">
                      {ticket.lotSize}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Destination</p>
                    <p className="font-semibold text-white">
                      {ticket.destination}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-cyan-950/30 p-3 text-sm text-cyan-200">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}
