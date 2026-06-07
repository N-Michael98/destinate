"use client";

import { useEffect, useState } from "react";

type QueueItem = {
  id: string;
  symbol: string;
  strategy: string;
  direction: string;
  requestedAction: string;
  queueStatus: string;
  basePositionSize: number;
  adjustedPositionSize: number;
  positionSizeMultiplier: number;
  approvalStatus: string;
  reason: string;
  createdAt: string;
};

type ResponseData = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalQueueItems: number;
    queuedItems: number;
    blockedItems: number;
    waitingItems: number;
    executionAllowed: boolean;
    executionQueueMode: string;
    queueItems: QueueItem[];
    recommendation: string;
    updatedAt: string;
  };
};

export default function TradeApprovalExecutionQueueDashboardPanel() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQueueSync() {
      try {
        const response = await fetch("/api/trade-approval-execution-queue-sync", {
          cache: "no-store",
        });
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Trade Approval Execution Queue Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadQueueSync();
  }, []);

  const report = data?.report;
  const items = report?.queueItems ?? [];

  return (
    <section className="rounded-2xl border border-sky-500/30 bg-slate-950/80 p-6 shadow-lg shadow-sky-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-sky-300">
            V11.8.9 Trade Approval Execution Queue Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Zeigt, ob genehmigte Trades in die Execution Queue dürfen oder blockiert werden.
          </p>
        </div>

        <div className="rounded-xl border border-sky-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Trade Approval Execution Queue Sync wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Execution Queue Sync Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Queue Mode" value={report.executionQueueMode} negative={report.executionQueueMode === "BLOCKED"} positive={report.executionQueueMode === "ACTIVE"} />
            <MetricCard title="Execution Allowed" value={report.executionAllowed ? "YES" : "NO"} positive={report.executionAllowed} negative={!report.executionAllowed} />
            <MetricCard title="Total Items" value={report.totalQueueItems} />
            <MetricCard title="Blocked Items" value={report.blockedItems} negative={report.blockedItems > 0} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard title="Queued Items" value={report.queuedItems} positive={report.queuedItems > 0} />
            <MetricCard title="Waiting Items" value={report.waitingItems} />
            <MetricCard title="Blocked Items" value={report.blockedItems} negative={report.blockedItems > 0} />
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-sky-300">
              Execution Queue Flow
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Unified Decision" value="Input" />
              <RouteBox title="Trade Approval" value="Gate" />
              <RouteBox title="Risk Gate" value={report.blockedItems > 0 ? "BLOCK" : "PASS"} />
              <RouteBox title="Execution Queue" value={report.executionQueueMode} />
              <RouteBox title="Broker Layer" value={report.executionAllowed ? "READY" : "BLOCKED"} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Queue Items
            </h3>

            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-lg font-bold text-sky-200">
                        {item.symbol}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.strategy}
                      </p>
                    </div>

                    <StatusBadge status={item.queueStatus} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <Info label="Direction" value={item.direction} />
                    <Info label="Action" value={item.requestedAction} />
                    <Info label="Approval" value={item.approvalStatus} />
                    <Info label="Base Size" value={item.basePositionSize} />
                    <Info label="Adjusted Size" value={item.adjustedPositionSize} />
                    <Info label="Multiplier" value={item.positionSizeMultiplier} />
                    <Info label="Created At" value={item.createdAt} />
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    {item.reason}
                  </p>
                </div>
              ))}

              {items.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Execution Queue Items vorhanden.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <p className="text-xs text-slate-400">Recommendation</p>
            <p className="mt-1 text-sm font-semibold text-cyan-200">
              {report.recommendation}
            </p>
          </div>

          <div className="text-xs text-slate-500">
            Engine Version: {report.version} | Mode: {report.mode} | Updated At: {report.updatedAt}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: string | number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          positive
            ? "text-emerald-400"
            : negative
              ? "text-red-400"
              : "text-sky-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-sky-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "QUEUED"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : status === "BLOCKED"
        ? "border-red-500/30 bg-red-950/40 text-red-300"
        : "border-orange-500/30 bg-orange-950/40 text-orange-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words font-semibold text-slate-200">{value}</p>
    </div>
  );
}
