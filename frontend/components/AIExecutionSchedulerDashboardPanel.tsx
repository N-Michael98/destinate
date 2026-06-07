"use client";

import { useEffect, useState } from "react";

type ScheduledExecutionItem = {
  id: string;
  symbol: string;
  tradingStyle: string;
  direction: string;
  schedulerStatus: string;
  executionUrgency: string;
  executionPriority: number;
  queuePosition: number;
  allowExecution: boolean;
  requireStrictApproval: boolean;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  portfolioBrainRoute: string;
  executionRule: string;
  reason: string;
  createdAt: string;
};

type AIExecutionSchedulerResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalInputs: number;
    scheduledItems: number;
    waitingItems: number;
    blockedItems: number;
    immediateItems: number;
    highPriorityItems: number;
    normalPriorityItems: number;
    lowPriorityItems: number;
    executionSchedulerMode: string;
    items: ScheduledExecutionItem[];
    systemRule: string;
    recommendation: string;
    updatedAt: string;
  };
};

export default function AIExecutionSchedulerDashboardPanel() {
  const [data, setData] = useState<AIExecutionSchedulerResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadScheduler() {
      try {
        const response = await fetch("/api/ai-execution-scheduler", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("AI Execution Scheduler Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadScheduler();
  }, []);

  const report = data?.report;
  const items = report?.items ?? [];

  return (
    <section className="rounded-2xl border border-fuchsia-500/30 bg-slate-950/80 p-6 shadow-lg shadow-fuchsia-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-fuchsia-300">
            V12.0.1 AI Execution Scheduler Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Priorisiert style-approved Trades, trennt Scheduled / Waiting / Blocked und bereitet Broker-Routing vor.
          </p>
        </div>

        <div className="rounded-xl border border-fuchsia-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          AI Execution Scheduler wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine AI Execution Scheduler Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <MetricCard
              title="Scheduler Mode"
              value={report.executionSchedulerMode}
              positive={report.executionSchedulerMode === "ACTIVE"}
              negative={report.executionSchedulerMode === "BLOCKED"}
            />
            <MetricCard title="Total Inputs" value={report.totalInputs} />
            <MetricCard title="Scheduled" value={report.scheduledItems} positive={report.scheduledItems > 0} />
            <MetricCard title="Waiting" value={report.waitingItems} />
            <MetricCard title="Blocked" value={report.blockedItems} negative={report.blockedItems > 0} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Immediate" value={report.immediateItems} positive={report.immediateItems > 0} />
            <MetricCard title="High Priority" value={report.highPriorityItems} positive={report.highPriorityItems > 0} />
            <MetricCard title="Normal Priority" value={report.normalPriorityItems} />
            <MetricCard title="Low Priority" value={report.lowPriorityItems} />
          </div>

          <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-fuchsia-300">
              Scheduler Flow
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Style Priority" value="Primary Style" />
              <RouteBox title="Trade Approval" value="Style Gates" />
              <RouteBox title="Scheduler" value={report.executionSchedulerMode} />
              <RouteBox title="Queue Order" value="Priority Sort" />
              <RouteBox title="Broker Layer" value="Prepared" />
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {report.systemRule}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Scheduled Execution Items
            </h3>

            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-lg font-bold text-fuchsia-200">
                        #{item.queuePosition || "-"} {item.symbol}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.tradingStyle} {item.direction} | {item.portfolioBrainRoute}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={item.schedulerStatus} />
                      <UrgencyBadge urgency={item.executionUrgency} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <Info label="Trading Style" value={item.tradingStyle} />
                    <Info label="Direction" value={item.direction} />
                    <Info label="Priority" value={item.executionPriority} />
                    <Info label="Queue Position" value={item.queuePosition} />
                    <Info label="Execution Allowed" value={item.allowExecution ? "YES" : "NO"} />
                    <Info label="Strict Approval" value={item.requireStrictApproval ? "YES" : "NO"} />
                    <Info label="Multiplier" value={item.positionSizeMultiplier} />
                    <Info label="Final Size" value={item.finalPositionSize} />
                    <Info label="Created At" value={item.createdAt} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
                      <p className="text-xs text-slate-500">Execution Rule</p>
                      <p className="mt-1 text-xs font-semibold text-slate-300">
                        {item.executionRule}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
                      <p className="text-xs text-slate-500">Reason</p>
                      <p className="mt-1 text-xs font-semibold text-slate-300">
                        {item.reason}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Scheduler Items vorhanden.
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
              : "text-fuchsia-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-fuchsia-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-fuchsia-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "SCHEDULED"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : status === "WAITING"
        ? "border-orange-500/30 bg-orange-950/40 text-orange-300"
        : "border-red-500/30 bg-red-950/40 text-red-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const className =
    urgency === "IMMEDIATE"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : urgency === "HIGH"
        ? "border-sky-500/30 bg-sky-950/40 text-sky-300"
        : urgency === "NORMAL"
          ? "border-violet-500/30 bg-violet-950/40 text-violet-300"
          : urgency === "LOW"
            ? "border-yellow-500/30 bg-yellow-950/40 text-yellow-300"
            : "border-red-500/30 bg-red-950/40 text-red-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {urgency}
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
