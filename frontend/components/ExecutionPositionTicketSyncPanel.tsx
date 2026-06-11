"use client";

import { useEffect, useState } from "react";

interface EvolvedBrokerTicketAllocation {
  brokerId: string;
  brokerName: string;
  allocationPercent: number;
  lotSize: number;
  notionalRiskPercent: number;
  status: "ACTIVE" | "SKIPPED" | "BLOCKED";
}

interface ExecutionPositionTicket {
  ticketId: string;
  sourceQueueItemId: string;
  symbol: string;
  side: "BUY" | "SELL" | "NONE";
  tradingStyle: string;
  priority: string;
  selectedBroker: string;
  ticketStatus: "READY" | "WAITING" | "BLOCKED";
  action: string;
  executionMode: string;
  originalRequestedLots: number;
  evolvedAllocatedLots: number;
  riskPercent: number;
  confidenceScore: number;
  brokerAllocations: EvolvedBrokerTicketAllocation[];
  estimatedFillQuality: number;
  estimatedLatencyMs: number;
  maxSlippagePercent: number;
  riskLockEnabled: true;
  readOnlySafe: true;
  liveExecutionBlocked: true;
  reason: string;
  createdAt: string;
}

interface ExecutionPositionTicketSyncReport {
  version: string;
  status: string;
  mode: string;
  totalItems: number;
  readyTickets: number;
  waitingTickets: number;
  blockedTickets: number;
  totalEvolvedLots: number;
  liveExecutionEnabled: false;
  tickets: ExecutionPositionTicket[];
  systemRule: string;
  recommendation: string;
  updatedAt: string;
}

function statusCls(s: string) {
  if (s === "READY" || s === "ACTIVE") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (s === "WAITING" || s === "SKIPPED") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function sideCls(s: string) {
  if (s === "BUY") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (s === "SELL") return "border-red-500/40 bg-red-500/10 text-red-300";
  return "border-slate-500/40 bg-slate-500/10 text-slate-400";
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function StatBox({ label, value, accent = "text-white" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

export default function ExecutionPositionTicketSyncPanel() {
  const [report, setReport] = useState<ExecutionPositionTicketSyncReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/execution-position-ticket-sync", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-indigo-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-400">V16.3.1</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Execution Position Ticket Sync</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Konvertiert position-synced Queue Items in Execution Tickets mit evolved Broker-Lot-Sizes aus der vollen Evolution-Chain.
          </p>
        </div>
        {report && (
          <span className={`rounded-full border px-4 py-2 text-xs font-bold ${statusCls(report.status)}`}>
            {report.status}
          </span>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-400">
          Lade Execution Position Ticket Sync...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <StatBox label="Total Tickets" value={report.totalItems} />
            <StatBox label="Ready" value={report.readyTickets} accent="text-emerald-400" />
            <StatBox label="Waiting" value={report.waitingTickets} accent="text-yellow-400" />
            <StatBox label="Blocked" value={report.blockedTickets} accent="text-red-400" />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Total Evolved Lots in Tickets</p>
            <p className="mt-3 text-3xl font-black text-indigo-300">{report.totalEvolvedLots}</p>
            <p className="mt-1 text-xs text-slate-500">Broker-level lot sizes from full Position Sizing Evolution chain</p>
          </div>

          <div className="space-y-4">
            {report.tickets.map((ticket) => (
              <div key={ticket.ticketId} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-mono text-slate-500">{ticket.ticketId}</p>
                      <h3 className="text-xl font-bold text-white">{ticket.symbol}</h3>
                      <Chip label={ticket.side} cls={sideCls(ticket.side)} />
                      <Chip label={ticket.ticketStatus} cls={statusCls(ticket.ticketStatus)} />
                      <Chip label={ticket.executionMode} cls={
                        ticket.executionMode === "PAPER"
                          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                          : "border-red-500/40 bg-red-500/10 text-red-300"
                      } />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Action: <span className="font-bold text-indigo-300">{ticket.action}</span>
                      {" · "}Style: <span className="font-bold text-white">{ticket.tradingStyle}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="Evolved Lots" value={ticket.evolvedAllocatedLots} />
                    <Metric label="Confidence" value={`${ticket.confidenceScore}%`} />
                    <Metric label="Fill Quality" value={`${ticket.estimatedFillQuality}%`} />
                  </div>
                </div>

                <div className="mb-4 grid gap-3 lg:grid-cols-4">
                  <Metric label="Original Lots" value={ticket.originalRequestedLots} />
                  <Metric label="Evolved Lots" value={ticket.evolvedAllocatedLots} />
                  <Metric label="Latency ms" value={ticket.estimatedLatencyMs} />
                  <Metric label="Max Slippage" value={`${ticket.maxSlippagePercent}%`} />
                </div>

                {ticket.brokerAllocations.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {ticket.brokerAllocations.map((a, i) => (
                      <div key={`${ticket.ticketId}-${i}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="font-bold text-white">{a.brokerName}</p>
                          <Chip label={a.status} cls={statusCls(a.status)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Metric label="Alloc %" value={`${a.allocationPercent}%`} />
                          <Metric label="Lots" value={a.lotSize} />
                          <Metric label="Risk %" value={`${a.notionalRiskPercent}%`} />
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-indigo-400" style={{ width: `${a.allocationPercent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
                  {ticket.reason}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <p className="text-sm text-indigo-300 font-semibold">{report.recommendation}</p>
            <p className="text-xs text-slate-400">{report.systemRule}</p>
            <p className="text-xs text-slate-500">
              Live Execution: <span className="text-red-300 font-bold">false</span>
              {" · "}Mode: <span className="text-indigo-300 font-bold">{report.mode}</span>
              {" · "}Updated: {new Date(report.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Execution Position Ticket Sync konnte nicht geladen werden.
        </div>
      )}
    </section>
  );
}
