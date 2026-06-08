"use client";

import { useEffect, useState } from "react";

type QueueTicket = {
  queueTicketId: string;
  species: string;
  queueStatus: string;
  queuePriority: string;
  queuePosition: number;
  executionWindow: string;
  scheduledBroker: string;
  backupBroker: string;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  queueReady: boolean;
  queueTarget: string;
};

type QueueReport = {
  version: string;
  status: string;
  mode: string;
  totalQueueTickets: number;
  queueReadyTickets: number;
  queueLimitedTickets: number;
  queueBlockedTickets: number;
  immediateWindowTickets: number;
  standardWindowTickets: number;
  tacticalWindowTickets: number;
  capitalComQueueTickets: number;
  icMarketsQueueTickets: number;
  dualBrokerQueueTickets: number;
  totalQueueCapitalUsd: number;
  totalQueuePositionSizeUsd: number;
  totalQueueLotSize: number;
  averageQueueFillQuality: number;
  averageQueueLatencyMs: number;
  primaryQueueSpecies: string;
  queueTickets: QueueTicket[];
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
    fetch("/api/species-execution-queue-integration")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-cyan-500/30 bg-black/40 p-5 shadow-lg shadow-cyan-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-cyan-300">
            Species Execution Queue
          </h2>
          <p className="text-sm text-zinc-400">
            V15.2.1 Dashboard Panel · Execution Queue Integration
          </p>
        </div>

        <div className="rounded-full border border-cyan-500/40 px-3 py-1 text-xs font-semibold text-cyan-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading queue integration...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Queue Tickets</p>
              <p className="text-lg font-bold text-white">
                {report.totalQueueTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Ready</p>
              <p className="text-lg font-bold text-green-400">
                {report.queueReadyTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Limited</p>
              <p className="text-lg font-bold text-yellow-400">
                {report.queueLimitedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Fill Quality</p>
              <p className="text-lg font-bold text-cyan-300">
                {report.averageQueueFillQuality}%
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Latency</p>
              <p className="text-lg font-bold text-white">
                {report.averageQueueLatencyMs} ms
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Primary</p>
              <p className="text-lg font-bold text-cyan-300">
                {report.primaryQueueSpecies}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Immediate</p>
              <p className="text-lg font-bold text-green-400">
                {report.immediateWindowTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Standard</p>
              <p className="text-lg font-bold text-white">
                {report.standardWindowTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Tactical</p>
              <p className="text-lg font-bold text-yellow-400">
                {report.tacticalWindowTickets}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Dual Broker</p>
              <p className="text-lg font-bold text-cyan-300">
                {report.dualBrokerQueueTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Capital.com</p>
              <p className="text-lg font-bold text-white">
                {report.capitalComQueueTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">IC Markets</p>
              <p className="text-lg font-bold text-white">
                {report.icMarketsQueueTickets}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.queueTickets.map((ticket) => (
              <div
                key={ticket.queueTicketId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      #{ticket.queuePosition} · {ticket.queueTicketId}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ticket.species}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-cyan-300">
                      {ticket.scheduledBroker}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ticket.queuePriority}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-6">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Window</p>
                    <p className="font-semibold text-white">
                      {ticket.executionWindow}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Status</p>
                    <p className="font-semibold text-white">
                      {ticket.queueStatus}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Capital</p>
                    <p className="font-semibold text-white">
                      {usd(ticket.capitalUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Fill</p>
                    <p className="font-semibold text-white">
                      {ticket.estimatedFillQuality}%
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Latency</p>
                    <p className="font-semibold text-white">
                      {ticket.estimatedLatencyMs} ms
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Ready</p>
                    <p className="font-semibold text-white">
                      {ticket.queueReady ? "YES" : "LIMITED"}
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
