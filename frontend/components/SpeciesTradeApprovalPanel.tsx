"use client";

import { useEffect, useState } from "react";

type ApprovalTicket = {
  tradeApprovalTicketId: string;
  species: string;
  approvalPriority: string;
  executionRank: number;
  capitalUsd: number;
  positionSizeUsd: number;
  lotSize: number;
  approvalStatus: string;
  maxRiskAllowed: boolean;
  approvalRole: string;
};

type ApprovalReport = {
  version: string;
  status: string;
  mode: string;
  source: string;
  target: string;
  symbol: string;
  totalApprovalTickets: number;
  approvalReadyTickets: number;
  approvalLimitedTickets: number;
  approvalBlockedTickets: number;
  totalApprovalCapitalUsd: number;
  totalApprovalPositionSizeUsd: number;
  totalApprovalLotSize: number;
  primarySpecies: string;
  approvalTickets: ApprovalTicket[];
  summary: string;
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SpeciesTradeApprovalPanel() {
  const [report, setReport] = useState<ApprovalReport | null>(null);

  useEffect(() => {
    fetch("/api/species-trade-approval-sync")
      .then((res) => res.json())
      .then((data) => setReport(data.report))
      .catch(() => setReport(null));
  }, []);

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-black/40 p-5 shadow-lg shadow-emerald-500/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-emerald-300">
            Species Trade Approval
          </h2>
          <p className="text-sm text-zinc-400">
            V14.9.1 Dashboard Panel · Approval Engine Integration
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300">
          {report?.status ?? "LOADING"}
        </div>
      </div>

      {!report ? (
        <p className="text-zinc-400">Loading approval tickets...</p>
      ) : (
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Tickets</p>
              <p className="text-lg font-bold text-white">
                {report.totalApprovalTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Ready</p>
              <p className="text-lg font-bold text-green-400">
                {report.approvalReadyTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Limited</p>
              <p className="text-lg font-bold text-yellow-400">
                {report.approvalLimitedTickets}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Primary</p>
              <p className="text-lg font-bold text-emerald-300">
                {report.primarySpecies}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900/80 p-3">
              <p className="text-xs text-zinc-500">Capital</p>
              <p className="text-lg font-bold text-white">
                {usd(report.totalApprovalCapitalUsd)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.approvalTickets.map((ticket) => (
              <div
                key={ticket.tradeApprovalTicketId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      #{ticket.executionRank} · {ticket.tradeApprovalTicketId}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.approvalRole}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-emerald-300">
                      {ticket.species}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {ticket.approvalPriority}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-5">
                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Status</p>
                    <p className="font-semibold text-white">
                      {ticket.approvalStatus}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Capital</p>
                    <p className="font-semibold text-white">
                      {usd(ticket.capitalUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Position</p>
                    <p className="font-semibold text-white">
                      {usd(ticket.positionSizeUsd)}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Lot</p>
                    <p className="font-semibold text-white">
                      {ticket.lotSize}
                    </p>
                  </div>

                  <div className="rounded bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-500">Risk</p>
                    <p className="font-semibold text-white">
                      {ticket.maxRiskAllowed ? "PASS" : "FAIL"}
                    </p>
                  </div>
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
