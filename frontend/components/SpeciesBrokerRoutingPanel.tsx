"use client";

import { useEffect, useState } from "react";

type RoutingTicket = {
  brokerRoutingTicketId: string;
  species: string;
  preferredBroker: string;
  backupBroker: string;
  routingPriority: string;
  routingStatus: string;
  executionDestination: string;
  brokerConfidence: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  executionRank: number;
};

type RoutingReport = {
  version: string;
  status: string;
  mode: string;
  source: string;
  target: string;
  symbol: string;
  totalRoutingTickets: number;
  routingReadyTickets: number;
  routingLimitedTickets: number;
  routingBlockedTickets: number;
  capitalComTickets: number;
  icMarketsTickets: number;
  dualBrokerTickets: number;
  totalRoutingCapitalUsd: number;
  totalRoutingPositionSizeUsd: number;
  totalRoutingLotSize: number;
  primaryBrokerSpecies: string;
  routingTickets: RoutingTicket[];
  summary: string;
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SpeciesBrokerRoutingPanel() {
  const [report, setReport] = useState<RoutingReport | null>(null);

  useEffect(() => {
    fetch("/api/species-broker-routing-sync")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-blue-500/30 bg-black/40 p-5 shadow-lg shadow-blue-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-blue-300">
            Species Broker Routing
          </h2>
          <p className="text-sm text-zinc-400">
            V15.0.1 Dashboard Panel · Broker Routing Layer
          </p>
        </div>

        <div className="rounded-full border border-blue-500/40 px-3 py-1 text-xs font-semibold text-blue-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading broker routing...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Tickets</p>
              <p className="text-lg font-bold text-white">
                {report.totalRoutingTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Ready</p>
              <p className="text-lg font-bold text-green-400">
                {report.routingReadyTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Limited</p>
              <p className="text-lg font-bold text-yellow-400">
                {report.routingLimitedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Dual Broker</p>
              <p className="text-lg font-bold text-blue-300">
                {report.dualBrokerTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Capital.com</p>
              <p className="text-lg font-bold text-white">
                {report.capitalComTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">IC Markets</p>
              <p className="text-lg font-bold text-white">
                {report.icMarketsTickets}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Capital</p>
              <p className="text-lg font-bold text-white">
                {usd(report.totalRoutingCapitalUsd)}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Lot Size</p>
              <p className="text-lg font-bold text-white">
                {report.totalRoutingLotSize}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Primary Species</p>
              <p className="text-lg font-bold text-blue-300">
                {report.primaryBrokerSpecies}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.routingTickets.map((ticket) => (
              <div
                key={ticket.brokerRoutingTicketId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      #{ticket.executionRank} · {ticket.brokerRoutingTicketId}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.species}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-blue-300">
                      {ticket.preferredBroker}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.routingPriority}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-5">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Status</p>
                    <p className="font-semibold text-white">
                      {ticket.routingStatus}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Confidence</p>
                    <p className="font-semibold text-white">
                      {ticket.brokerConfidence}%
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Capital</p>
                    <p className="font-semibold text-white">
                      {usd(ticket.capitalUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Backup</p>
                    <p className="font-semibold text-white">
                      {ticket.backupBroker}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Destination</p>
                    <p className="font-semibold text-white">
                      {ticket.executionDestination}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-blue-950/30 p-3 text-sm text-blue-200">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}
