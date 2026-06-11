"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AllocationDonutChart,
  MetricBarChart,
  PerformanceLineChart,
} from "./charts";

type EvolutionDecision = {
  key: string;
  title: string;
  status: string;
  score: number;
  reason: string;
};

type AutonomousEvolutionReport = {
  version: string;
  status: string;
  cycleId: string;
  rankingVersion: string;
  mutationVersion: string;
  breedingVersion: string;
  survivalVersion: string;
  governanceVersion: string;
  totalRankedStrategies: number;
  totalMutations: number;
  totalHybrids: number;
  totalSpecies: number;
  championSpecies: string;
  topStrategy: string;
  bestMutation: string;
  bestHybrid: string;
  autonomousEvolutionScore: number;
  cycleDecision: string;
  decisions: EvolutionDecision[];
  summary: string;
  createdAt: string;
};

type EvolutionMemoryStats = {
  totalMemories: number;
  averageEvolutionScore: number;
  bestEvolutionScore: number;
  weakestEvolutionScore: number;
  latestTopStrategy: string;
  latestChampionSpecies: string;
  continueEvolutionCycles: number;
  reduceRiskCycles: number;
  pausedEvolutionCycles: number;
};

type EvolutionMemoryReport = {
  version: string;
  status: string;
  stats: EvolutionMemoryStats;
  recommendation: string;
};

const speciesAllocation = [
  { label: "HYBRID", value: 39 },
  { label: "LIQUIDITY", value: 19 },
  { label: "TREND", value: 19 },
  { label: "INSTITUTIONAL", value: 19 },
  { label: "BREAKOUT", value: 4 },
  { label: "MEAN_REVERSION", value: 0 },
];

const readinessData = [
  { label: "Ranking", value: 100 },
  { label: "Mutation", value: 90 },
  { label: "Breeding", value: 85 },
  { label: "Memory", value: 80 },
];

const pipelineStages = [
  "Strategy Ranking",
  "Mutation",
  "Breeding",
  "Species Survival",
  "Evolution Governance",
  "Autonomous Score",
  "Cycle Decision",
  "Memory Snapshot",
];

export default function EvolutionCenterPanel() {
  const [report, setReport] = useState<AutonomousEvolutionReport | null>(null);
  const [memory, setMemory] = useState<EvolutionMemoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadEvolution() {
    setLoading(true);

    try {
      const [evolutionResponse, memoryResponse] = await Promise.all([
        fetch("/api/autonomous-trading-evolution", { cache: "no-store" }).catch(() => null),
        fetch("/api/autonomous-trading-evolution-memory", { cache: "no-store" }).catch(() => null),
      ]);

      const evolutionData = evolutionResponse ? await evolutionResponse.json().catch(() => null) : null;
      const memoryData = memoryResponse ? await memoryResponse.json().catch(() => null) : null;

      if (evolutionData?.ok && evolutionData.report) {
        setReport(evolutionData.report);
      }

      if (memoryData?.ok && memoryData.memory) {
        setMemory(memoryData.memory);
      }
    } catch {
      // silently handle network errors — component shows empty state
    } finally {
      setLoading(false);
    }
  }

  async function saveSnapshot() {
    setSaving(true);

    try {
      const response = await fetch("/api/autonomous-trading-evolution-memory", {
        method: "POST",
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (data?.ok && data.memory) {
        setMemory(data.memory);
      }

      if (data?.ok && data.report) {
        setReport(data.report);
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadEvolution();
  }, []);

  const scoreData = useMemo(() => {
    return [
      { label: "Evolution", value: report?.autonomousEvolutionScore ?? 0 },
      { label: "Average", value: memory?.stats.averageEvolutionScore ?? 0 },
      { label: "Best", value: memory?.stats.bestEvolutionScore ?? 0 },
      { label: "Weakest", value: memory?.stats.weakestEvolutionScore ?? 0 },
    ];
  }, [report, memory]);

  return (
    <section className="rounded-3xl border border-purple-500/30 bg-zinc-950/70 p-6 shadow-2xl shadow-purple-950/30">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">
            V16.0.4 Autonomous Trading Evolution
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Autonomous Trading Evolution Dashboard
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Central control panel for the autonomous trading bot evolution cycle, memory and strategy species intelligence.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadEvolution}
            disabled={loading}
            className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            onClick={saveSnapshot}
            disabled={saving}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Snapshot"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Evolution Score" value={report?.autonomousEvolutionScore ?? "—"} detail={report?.status ?? "Loading"} />
        <Metric label="Decision" value={report?.cycleDecision ?? "—"} detail="Cycle decision" />
        <Metric label="Champion" value={report?.championSpecies ?? "—"} detail="Species leader" />
        <Metric label="Strategies" value={report?.totalRankedStrategies ?? "—"} detail="Ranked universe" />
        <Metric label="Mutations" value={report?.totalMutations ?? "—"} detail="Generated variants" />
        <Metric label="Memory" value={memory?.stats.totalMemories ?? "—"} detail="Stored cycles" />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <InfoCard title="Top Strategy" value={report?.topStrategy ?? "Loading..."} accent="text-emerald-300" />
        <InfoCard title="Best Mutation" value={report?.bestMutation ?? "Loading..."} accent="text-purple-300" />
        <InfoCard title="Best Hybrid" value={report?.bestHybrid ?? "Loading..."} accent="text-cyan-300" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MetricBarChart
          title="Evolution Score Memory"
          subtitle="Current score compared with stored memory statistics."
          data={scoreData}
          footer="The bot uses these values to understand evolution strength over time."
        />

        <AllocationDonutChart
          title="Species Allocation"
          subtitle="Current simulated species allocation overview."
          data={speciesAllocation}
          footer="HYBRID remains the dominant adaptive species."
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <PerformanceLineChart
          title="Autonomous Pipeline Readiness"
          subtitle="Readiness across ranking, mutation, breeding and memory."
          data={readinessData}
          footer="Read-only simulation mode. No live orders are executed."
        />

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
          <h3 className="text-sm font-bold text-yellow-300">
            Evolution Memory Recommendation
          </h3>
          <p className="mt-3 text-sm text-zinc-300">
            {memory?.recommendation ?? "Memory recommendation is loading."}
          </p>

          <div className="mt-4 grid gap-2 text-sm">
            <Row label="Average Score" value={String(memory?.stats.averageEvolutionScore ?? "—")} />
            <Row label="Best Score" value={String(memory?.stats.bestEvolutionScore ?? "—")} />
            <Row label="Continue Cycles" value={String(memory?.stats.continueEvolutionCycles ?? "—")} />
            <Row label="Reduce Risk Cycles" value={String(memory?.stats.reduceRiskCycles ?? "—")} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-4">
        <h3 className="text-sm font-bold text-cyan-300">
          Autonomous Evolution Pipeline
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Clean overview of how the bot evolves strategies toward future autonomous execution.
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

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-5">
        <h3 className="text-sm font-bold text-white">Decision Engine</h3>

        <div className="mt-4 grid gap-3 xl:grid-cols-5">
          {(report?.decisions ?? []).map((decision) => (
            <div
              key={decision.key}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
            >
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                {decision.status}
              </span>
              <h4 className="mt-3 text-sm font-bold text-white">
                {decision.title}
              </h4>
              <p className="mt-2 text-2xl font-black text-white">
                {decision.score}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {decision.reason}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function InfoCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
      <h3 className={`text-sm font-bold ${accent}`}>{title}</h3>
      <p className="mt-3 text-sm text-zinc-300">{value}</p>
    </div>
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
