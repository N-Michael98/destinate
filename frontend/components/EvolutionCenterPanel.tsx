"use client";

import {
  AllocationDonutChart,
  MetricBarChart,
  PerformanceLineChart,
} from "./charts";

const evolutionMetrics = [
  { label: "Evolution Modules", value: "18", detail: "Active Species Pipeline" },
  { label: "Total Allocation", value: "100%", detail: "Normalized Allocation" },
  { label: "Capital", value: "$100,000", detail: "Species Capital Base" },
  { label: "Queue Tickets", value: "11", detail: "Execution Queue Ready" },
  { label: "Live Ready", value: "10", detail: "Bridge Ready Tickets" },
  { label: "Broker Sync", value: "10/11", detail: "Dispatch Ready" },
];

const speciesAllocation = [
  { label: "HYBRID", value: 39 },
  { label: "LIQUIDITY", value: 19 },
  { label: "TREND", value: 19 },
  { label: "INSTITUTIONAL", value: 19 },
  { label: "BREAKOUT", value: 4 },
  { label: "MEAN_REVERSION", value: 0 },
];

const capitalAllocation = [
  { label: "HYBRID", value: 39000 },
  { label: "LIQUIDITY", value: 19000 },
  { label: "TREND", value: 19000 },
  { label: "INSTITUTIONAL", value: 19000 },
  { label: "BREAKOUT", value: 4000 },
  { label: "MEAN_REV", value: 0 },
];

const brokerDistribution = [
  { label: "DUAL_BROKER", value: 6 },
  { label: "CAPITAL_COM", value: 2 },
  { label: "IC_MARKETS", value: 3 },
];

const readinessData = [
  { label: "Queue", value: 10 },
  { label: "Bridge", value: 10 },
  { label: "Dispatch", value: 10 },
  { label: "Limited", value: 1 },
];

const pipelineStages = [
  "Mutation",
  "Breeding",
  "Classification",
  "Survival",
  "Extinction",
  "Governance",
  "Allocation",
  "Capital",
  "Sizing",
  "Trade Allocation",
  "Execution Queue",
  "Live Bridge",
  "Broker Sync",
];

export default function EvolutionCenterPanel() {
  return (
    <section className="rounded-3xl border border-purple-500/30 bg-zinc-950/70 p-6 shadow-2xl shadow-purple-950/30">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">
            V15.A.7 Evolution Charts
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Evolution Species Intelligence Dashboard
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Professional visual overview for the complete Evolution → Species → Execution → Broker Sync pipeline.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
          EVOLUTION ACTIVE
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {evolutionMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-zinc-800 bg-black/40 p-4"
          >
            <p className="text-xs text-zinc-500">{metric.label}</p>
            <p className="mt-2 text-xl font-bold text-white">{metric.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AllocationDonutChart
          title="Species Allocation"
          subtitle="Normalized Evolution allocation by Species."
          data={speciesAllocation}
          footer="HYBRID remains the primary adaptive allocation core."
        />

        <MetricBarChart
          title="Capital Allocation"
          subtitle="Simulated capital assignment by Species."
          data={capitalAllocation}
          footer="Capital base: 100,000 USD simulation."
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <MetricBarChart
          title="Broker Distribution"
          subtitle="Execution routing distribution across broker targets."
          data={brokerDistribution}
          footer="Dual broker routing remains dominant for Hybrid and Institutional tickets."
        />

        <PerformanceLineChart
          title="Execution Readiness"
          subtitle="Queue, bridge and broker dispatch readiness."
          data={readinessData}
          footer="10 of 11 tickets are fully ready. 1 tactical ticket remains limited."
        />
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-4">
        <h3 className="text-sm font-bold text-cyan-300">
          Evolution Pipeline Flow
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Clean overview of how Species intelligence flows toward execution.
        </p>

        <div className="mt-4 grid gap-2">
          {pipelineStages.map((stage, index) => (
            <div key={stage} className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-xs font-bold text-cyan-300">
                {index + 1}
              </div>
              <div className="flex-1 rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300">
                {stage}
              </div>
              <div className="text-xs text-emerald-300">ACTIVE</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-emerald-300">
            Execution Readiness
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Queue Ready" value="10 / 11" />
            <Row label="Live Bridge Ready" value="10 / 11" />
            <Row label="Dispatch Ready" value="10 / 11" />
            <Row label="Limited Tactical" value="1 / 11" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-blue-300">
            Broker Distribution
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Dual Broker" value="6" />
            <Row label="Capital.com" value="2" />
            <Row label="IC Markets" value="3" />
            <Row label="Blocked Broker" value="0" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-yellow-300">
            Next Upgrade
          </h3>
          <p className="mt-3 text-sm text-zinc-300">
            Extend chart system into Broker Center, Portfolio Brain Center and Learning Center.
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-zinc-900/70 px-3 py-2">
      <span className="text-zinc-400">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
