"use client";

import { useEffect, useState } from "react";

type StrategyWeightPortfolioBrainSyncDecision = {
  id: string;
  strategy: string;
  symbol: string;
  currentWeight: number;
  recommendedWeight: number;
  weightChange: number;
  status: string;
  portfolioBrainImpact: string;
  tradeApprovalImpact: string;
  positionSizingImpact: string;
  reason: string;
};

type StrategyWeightPortfolioBrainSyncResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalSyncItems: number;
    exposureIncreases: number;
    exposureReductions: number;
    exposureHolds: number;
    strictApprovalItems: number;
    normalApprovalItems: number;
    flexibleApprovalItems: number;
    totalCurrentWeight: number;
    totalSyncedWeight: number;
    portfolioBrainMode: string;
    decisions: StrategyWeightPortfolioBrainSyncDecision[];
    aiCommunicationNote: string;
    recommendation: string;
    updatedAt: string;
  };
};

export default function StrategyWeightPortfolioBrainSyncDashboardPanel() {
  const [data, setData] = useState<StrategyWeightPortfolioBrainSyncResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSync() {
      try {
        const response = await fetch("/api/strategy-weight-portfolio-brain-sync", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Strategy Weight Portfolio Brain Sync Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSync();
  }, []);

  const report = data?.report;
  const decisions = report?.decisions ?? [];
  const totalWeightChange =
    report ? report.totalSyncedWeight - report.totalCurrentWeight : 0;

  return (
    <section className="rounded-2xl border border-rose-500/30 bg-slate-950/80 p-6 shadow-lg shadow-rose-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-rose-300">
            V11.8.3 Strategy Weight Portfolio Brain Sync Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Zeigt, wie Strategy Weight Auto-Rebalancing den Portfolio Brain, Trade Approval und Position Sizing beeinflusst.
          </p>
        </div>

        <div className="rounded-xl border border-rose-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Strategy Weight Portfolio Brain Sync wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Strategy Weight Portfolio Brain Sync Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Sync Items" value={report.totalSyncItems} />
            <MetricCard title="Portfolio Mode" value={report.portfolioBrainMode} negative={report.portfolioBrainMode === "DEFENSIVE"} positive={report.portfolioBrainMode === "AGGRESSIVE"} />
            <MetricCard title="Exposure Reductions" value={report.exposureReductions} negative={report.exposureReductions > 0} />
            <MetricCard title="Exposure Increases" value={report.exposureIncreases} positive={report.exposureIncreases > 0} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Strict Approval" value={report.strictApprovalItems} negative={report.strictApprovalItems > 0} />
            <MetricCard title="Normal Approval" value={report.normalApprovalItems} />
            <MetricCard title="Flexible Approval" value={report.flexibleApprovalItems} positive={report.flexibleApprovalItems > 0} />
            <MetricCard title="Total Change" value={totalWeightChange} positive={totalWeightChange > 0} negative={totalWeightChange < 0} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <WeightCard title="Current Weight" value={report.totalCurrentWeight} />
            <WeightCard title="Synced Weight" value={report.totalSyncedWeight} />
            <WeightCard title="Weight Delta" value={totalWeightChange} negative={totalWeightChange < 0} positive={totalWeightChange > 0} />
          </div>

          <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-rose-300">
              Portfolio Brain Sync Flow
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Strategy Weights" value="Input" />
              <RouteBox title="Portfolio Brain" value={report.portfolioBrainMode} />
              <RouteBox title="Trade Approval" value="Approval Filter" />
              <RouteBox title="Position Sizing" value="Size Control" />
              <RouteBox title="Execution Queue" value="Next Gate" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Strategy Weight Sync Decisions
            </h3>

            <div className="space-y-4">
              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-lg font-bold text-rose-200">
                        {decision.symbol}
                      </p>
                      <p className="text-xs text-slate-400">
                        {decision.strategy}
                      </p>
                    </div>

                    <StatusBadge status={decision.status} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <Info label="Current Weight" value={decision.currentWeight} />
                    <Info label="Recommended Weight" value={decision.recommendedWeight} />
                    <Info label="Weight Change" value={decision.weightChange} />
                    <Info label="Portfolio Impact" value={decision.portfolioBrainImpact} />
                    <Info label="Trade Approval" value={decision.tradeApprovalImpact} />
                    <Info label="Position Sizing" value={decision.positionSizingImpact} />
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    {decision.reason}
                  </p>
                </div>
              ))}

              {decisions.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Strategy Weight Portfolio Brain Sync Decisions vorhanden.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
            <p className="text-xs text-slate-400">AI Communication Note</p>
            <p className="mt-1 text-sm font-semibold text-violet-200">
              {report.aiCommunicationNote}
            </p>
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
              : "text-rose-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function WeightCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={`mt-2 text-3xl font-bold ${
          positive
            ? "text-emerald-400"
            : negative
              ? "text-red-400"
              : "text-rose-300"
        }`}
      >
        {value}
      </p>

      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-rose-400"
          style={{ width: `${Math.max(0, Math.min(100, Math.abs(value)))}%` }}
        />
      </div>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-rose-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-rose-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "BOOST"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : status === "REDUCE"
        ? "border-red-500/30 bg-red-950/40 text-red-300"
        : status === "DEFENSIVE_HOLD"
          ? "border-orange-500/30 bg-orange-950/40 text-orange-300"
          : "border-slate-500/30 bg-slate-950/40 text-slate-300";

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
