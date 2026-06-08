"use client";

import { useEffect, useState } from "react";

type QueueTicket = {
  ticketId: string;
  species: string;
  slotNumber: number;
  queuePriority: string;
  executionPermission: string;
  ticketStatus: string;
  capitalPerTradeUsd: number;
  positionSizePerTradeUsd: number;
  lotSizePerTrade: number;
  executionRank: number;
  routingHint: string;
  ticketRole: string;
};

type QueueReport = {
  version: string;
  status: string;
  mode: string;
  baseSymbol: string;
  totalQueueTickets: number;
  readyTickets: number;
  limitedTickets: number;
  blockedTickets: number;
  primarySpecies: string;
  queueTickets: QueueTicket[];
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

export default function SpeciesExecutionQueuePanel() {
  const [report, setReport] = useState<QueueReport | null>(null);

  useEffect(() => {
    fetch("/api/species-execution-queue")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-rose-500/30 bg-black/40 p-5 shadow-lg shadow-rose-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-rose-300">
            Species Execution Queue
          </h2>
          <p className="text-sm text-zinc-400">
            V14.7.1 Dashboard Panel · Queue Tickets & Execution Routing
          </p>
        </div>

        <div className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading execution queue...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Queue Tickets</p>
              <p className="text-lg font-bold text-white">
                {report.totalQueueTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Ready</p>
              <p className="text-lg font-bold text-green-400">
                {report.readyTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Limited</p>
              <p className="text-lg font-bold text-yellow-400">
                {report.limitedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Blocked</p>
              <p className="text-lg font-bold text-red-400">
                {report.blockedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Primary</p>
              <p className="text-lg font-bold text-rose-300">
                {report.primarySpecies}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.queueTickets.map((ticket) => (
              <div
                key={ticket.ticketId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      #{ticket.executionRank} · {ticket.ticketId}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.ticketRole}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-rose-300">
                      {ticket.species}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.queuePriority}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-5">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Status</p>
                    <p className="font-semibold text-white">
                      {ticket.ticketStatus}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Capital</p>
                    <p className="font-semibold text-white">
                      {usd(ticket.capitalPerTradeUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Position</p>
                    <p className="font-semibold text-white">
                      {usd(ticket.positionSizePerTradeUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Lot</p>
                    <p className="font-semibold text-white">
                      {ticket.lotSizePerTrade}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Route</p>
                    <p className="font-semibold text-white">
                      {ticket.routingHint}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-rose-950/30 p-3 text-sm text-rose-200">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}
