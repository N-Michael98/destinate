"use client";

import { useEffect, useState } from "react";

interface SyncedBrokerAllocation {
  brokerId: string;
  brokerName: string;
  allocationPercent: number;
  brokerScore: number;
  lotSize: number;
  notionalRiskPercent: number;
  status: "ACTIVE" | "SKIPPED" | "BLOCKED";
  reason: string;
}

interface PositionSyncedQueueItem {
  queueItemId: string;
  symbol: string;
  side: "BUY" | "SELL" | "NONE";
  tradingStyle: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  selectedBroker: string;
  originalRequestedLots: number;
  evolvedAllocatedLots: number;
  unallocatedLots: number;
  riskPercent: number;
  confidenceScore: number;
  brokerAllocations: SyncedBrokerAllocation[];
  syncStatus: "SYNCED" | "PARTIAL_SYNC" | "BLOCKED" | "READY";
  readyForPaperExecution: boolean;
  liveExecutionBlocked: true;
  syncReason: string;
}

interface ExecutionQueuePositionSyncReport {
  version: string;
  status: string;
  mode: string[];
  totalItems: number;
  syncedItems: number;
  partialSyncItems: number;
  blockedItems: number;
  readyForPaperExecutionItems: number;
  totalEvolvedLots: number;
  totalUnallocatedLots: number;
  items: PositionSyncedQueueItem[];
  summary: string;
  safety: {
    liveTradingEnabled: false;
    orderExecutionEnabled: false;
    brokerConnectionMode: string;
    positionSyncMode: string;
  };
  updatedAt: string;
}

function cls(...args: (string | false | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

function statusCls(status: string) {
  if (status === "SYNCED" || status === "READY" || status === "ACTIVE")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (status === "PARTIAL_SYNC" || status === "SKIPPED")
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function sideCls(side: string) {
  if (side === "BUY") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (side === "SELL") return "border-red-500/40 bg-red-500/10 text-red-300";
  return "border-slate-500/40 bg-slate-500/10 text-slate-400";
}

function priorityCls(priority: string) {
  if (priority === "HIGH") return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  if (priority === "MEDIUM") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  return "border-slate-500/40 bg-slate-500/10 text-slate-300";
}

function Chip({ label, cls: c }: { label: string; cls: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${c}`}>{label}</span>
  );
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

export default function ExecutionQueuePositionSyncPanel() {
  const [report, setReport] = useState<ExecutionQueuePositionSyncReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/execution-queue-position-sync", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-violet-950/20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-400">V16.3.0</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Execution Queue Position Sync</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Injiziert evolved Broker-Lot-Sizes aus Dynamic Position Allocation in die Execution Queue Items — bereit für Execution Tickets.
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
          Lade Execution Queue Position Sync...
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-5">
            <StatBox label="Total Items" value={report.totalItems} />
            <StatBox label="Synced" value={report.syncedItems} accent="text-emerald-400" />
            <StatBox label="Partial" value={report.partialSyncItems} accent="text-yellow-400" />
            <StatBox label="Blocked" value={report.blockedItems} accent="text-red-400" />
            <StatBox label="Ready Paper Exec" value={report.readyForPaperExecutionItems} accent="text-violet-400" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Total Evolved Lots</p>
              <p className="mt-3 text-3xl font-black text-violet-300">{report.totalEvolvedLots}</p>
              <p className="mt-1 text-xs text-slate-500">Injected from Position Sizing Evolution chain</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Unallocated Lots</p>
              <p className="mt-3 text-3xl font-black text-slate-300">{report.totalUnallocatedLots}</p>
              <p className="mt-1 text-xs text-slate-500">Remaining after broker allocation</p>
            </div>
          </div>

          <div className="space-y-4">
            {report.items.map((item) => (
              <div key={item.queueItemId} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-white">{item.symbol}</h3>
                      <Chip label={item.side} cls={sideCls(item.side)} />
                      <Chip label={item.priority} cls={priorityCls(item.priority)} />
                      <Chip label={item.syncStatus} cls={statusCls(item.syncStatus)} />
                      {item.readyForPaperExecution && (
                        <Chip label="PAPER READY" cls="border-violet-500/40 bg-violet-500/10 text-violet-300" />
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Style: <span className="font-bold text-violet-300">{item.tradingStyle}</span>
                      {" · "}Broker: <span className="font-bold text-white">{item.selectedBroker}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="Evolved Lots" value={item.evolvedAllocatedLots} />
                    <Metric label="Risk %" value={`${item.riskPercent}%`} />
                    <Metric label="Confidence" value={`${item.confidenceScore}%`} />
                  </div>
                </div>

                <div className="mb-4 grid gap-3 lg:grid-cols-3">
                  <Metric label="Original Requested" value={`${item.originalRequestedLots} lots`} />
                  <Metric label="Evolved Allocated" value={`${item.evolvedAllocatedLots} lots`} />
                  <Metric label="Unallocated" value={`${item.unallocatedLots} lots`} />
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {item.brokerAllocations.map((a) => (
                    <div key={a.brokerId} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p className="font-bold text-white">{a.brokerName}</p>
                          <p className="text-xs text-slate-500">Score {a.brokerScore}</p>
                        </div>
                        <Chip label={a.status} cls={statusCls(a.status)} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Metric label="Allocation" value={`${a.allocationPercent}%`} />
                        <Metric label="Lots" value={a.lotSize} />
                        <Metric label="Risk" value={`${a.notionalRiskPercent}%`} />
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-violet-400" style={{ width: `${a.allocationPercent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
                  {item.syncReason}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">{report.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.mode.map((m) => (
                <span key={m} className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">{m}</span>
              ))}
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
                {report.safety.positionSyncMode}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Live Trading: <span className="text-red-300 font-bold">false</span>
              {" · "}Updated: {new Date(report.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Execution Queue Position Sync konnte nicht geladen werden.
        </div>
      )}
    </section>
  );
}
