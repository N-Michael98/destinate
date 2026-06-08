"use client";

import { useEffect, useState } from "react";

type ExecutionTicket = {
  executionTicketId: string;
  species: string;
  executionBroker: string;
  backupBroker: string;
  executionStatus: string;
  executionPriority: string;
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  brokerConfidence: number;
  readyForExecution: boolean;
  executionQueueTarget: string;
};

type ExecutionReport = {
  version: string;
  status: string;
  mode: string;
  totalExecutionTickets: number;
  executionReadyTickets: number;
  executionLimitedTickets: number;
  executionBlockedTickets: number;
  capitalComExecutionTickets: number;
  icMarketsExecutionTickets: number;
  dualBrokerExecutionTickets: number;
  totalExecutionCapitalUsd: number;
  totalExecutionPositionSizeUsd: number;
  totalExecutionLotSize: number;
  averageFillQuality: number;
  averageLatencyMs: number;
  primaryExecutionSpecies: string;
  executionTickets: ExecutionTicket[];
  summary: string;
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SpeciesExecutionTicketPanel() {
  const [report, setReport] = useState<ExecutionReport | null>(null);

  useEffect(() => {
    fetch("/api/species-execution-ticket-generator")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-black/40 p-5 shadow-lg shadow-violet-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-violet-300">
            Species Execution Tickets
          </h2>
          <p className="text-sm text-zinc-400">
            V15.1.1 Dashboard Panel · Execution Ticket Generator
          </p>
        </div>

        <div className="rounded-full border border-violet-500/40 px-3 py-1 text-xs font-semibold text-violet-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading execution tickets...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Tickets</p>
              <p className="text-lg font-bold text-white">
                {report.totalExecutionTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Ready</p>
              <p className="text-lg font-bold text-green-400">
                {report.executionReadyTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Limited</p>
              <p className="text-lg font-bold text-yellow-400">
                {report.executionLimitedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Fill Quality</p>
              <p className="text-lg font-bold text-violet-300">
                {report.averageFillQuality}%
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Latency</p>
              <p className="text-lg font-bold text-white">
                {report.averageLatencyMs} ms
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Primary</p>
              <p className="text-lg font-bold text-violet-300">
                {report.primaryExecutionSpecies}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Dual Broker</p>
              <p className="text-lg font-bold text-violet-300">
                {report.dualBrokerExecutionTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Capital.com</p>
              <p className="text-lg font-bold text-white">
                {report.capitalComExecutionTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">IC Markets</p>
              <p className="text-lg font-bold text-white">
                {report.icMarketsExecutionTickets}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.executionTickets.map((ticket) => (
              <div
                key={ticket.executionTicketId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      #{ticket.executionRank} · {ticket.executionTicketId}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.species}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-violet-300">
                      {ticket.executionBroker}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.executionPriority}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-6">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Status</p>
                    <p className="font-semibold text-white">
                      {ticket.executionStatus}
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
                      {ticket.readyForExecution ? "YES" : "LIMITED"}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Queue</p>
                    <p className="font-semibold text-white">
                      {ticket.executionQueueTarget}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-violet-950/30 p-3 text-sm text-violet-200">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}
