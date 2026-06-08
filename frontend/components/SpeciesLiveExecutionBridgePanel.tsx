"use client";

import { useEffect, useState } from "react";

type BridgeTicket = {
  bridgeTicketId: string;
  species: string;
  bridgeStatus: string;
  brokerHandshakeStatus: string;
  executionBridgeHealth: string;
  bridgePriority: string;
  scheduledBroker: string;
  queuePosition: number;
  executionWindow: string;
  capitalUsd: number;
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  liveExecutionReady: boolean;
};

type BridgeReport = {
  version: string;
  status: string;
  totalBridgeTickets: number;
  liveReadyTickets: number;
  liveLimitedTickets: number;
  liveBlockedTickets: number;
  healthyBridgeTickets: number;
  degradedBridgeTickets: number;
  blockedBridgeTickets: number;
  handshakeReadyTickets: number;
  handshakeLimitedTickets: number;
  handshakeBlockedTickets: number;
  averageBridgeFillQuality: number;
  averageBridgeLatencyMs: number;
  primaryBridgeSpecies: string;
  totalBridgeCapitalUsd: number;
  bridgeTickets: BridgeTicket[];
  summary: string;
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SpeciesLiveExecutionBridgePanel() {
  const [report, setReport] = useState<BridgeReport | null>(null);

  useEffect(() => {
    fetch("/api/species-live-execution-bridge")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-black/40 p-5 shadow-lg shadow-emerald-500/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-emerald-300">
            Species Live Execution Bridge
          </h2>
          <p className="text-sm text-zinc-400">
            V15.3.1 Dashboard Panel
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading bridge...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Metric title="Bridge Tickets" value={report.totalBridgeTickets} />
            <Metric title="Ready" value={report.liveReadyTickets} />
            <Metric title="Limited" value={report.liveLimitedTickets} />
            <Metric title="Healthy" value={report.healthyBridgeTickets} />
            <Metric title="Handshake" value={report.handshakeReadyTickets} />
            <Metric title="Primary" value={report.primaryBridgeSpecies} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric
              title="Fill Quality"
              value={`${report.averageBridgeFillQuality}%`}
            />
            <Metric
              title="Latency"
              value={`${report.averageBridgeLatencyMs} ms`}
            />
            <Metric
              title="Capital"
              value={usd(report.totalBridgeCapitalUsd)}
            />
            <Metric
              title="Blocked"
              value={report.liveBlockedTickets}
            />
          </div>

          <div className="space-y-2">
            {report.bridgeTickets.map((ticket) => (
              <div
                key={ticket.bridgeTicketId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">
                      #{ticket.queuePosition} · {ticket.bridgeTicketId}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ticket.species}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-emerald-300">
                      {ticket.scheduledBroker}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ticket.bridgePriority}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-6 gap-2 mt-3">
                  <Info label="Status" value={ticket.bridgeStatus} />
                  <Info label="Health" value={ticket.executionBridgeHealth} />
                  <Info label="Handshake" value={ticket.brokerHandshakeStatus} />
                  <Info label="Window" value={ticket.executionWindow} />
                  <Info label="Fill" value={`${ticket.estimatedFillQuality}%`} />
                  <Info label="Latency" value={`${ticket.estimatedLatencyMs} ms`} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-emerald-950/30 p-3 text-sm text-emerald-200">
            {report.summary}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-zinc-900/80 p-3">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded bg-zinc-900 p-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}
