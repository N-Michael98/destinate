"use client";

import { useEffect, useState } from "react";

type StrategyWeightDecision = {
  id: string;
  strategy: string;
  symbol: string;
  currentWeight: number;
  recommendedWeight: number;
  weightChange: number;
  maxAllowedWeight: number;
  learningScore: number;
  combinedConfidenceScore: number;
  combinedRiskScore: number;
  combinedStrategyScore: number;
  status: string;
  allowWeightIncrease: boolean;
  requireWeightReduction: boolean;
  reason: string;
};

type StrategyWeightResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalStrategies: number;
    boostedStrategies: number;
    reducedStrategies: number;
    heldStrategies: number;
    defensiveHeldStrategies: number;
    totalCurrentWeight: number;
    totalRecommendedWeight: number;
    institutionalRiskMode: string;
    decisions: StrategyWeightDecision[];
    recommendation: string;
    updatedAt: string;
  };
};

export default function StrategyWeightAutoRebalancingDashboardPanel() {
  const [data, setData] = useState<StrategyWeightResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStrategyWeights() {
      try {
        const response = await fetch("/api/strategy-weight-auto-rebalancing", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Strategy Weight Auto-Rebalancing Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStrategyWeights();
  }, []);

  const report = data?.report;
  const decisions = report?.decisions ?? [];
  const totalWeightChange =
    report ? report.totalRecommendedWeight - report.totalCurrentWeight : 0;

  return (
    <section className="rounded-2xl border border-fuchsia-500/30 bg-slate-950/80 p-6 shadow-lg shadow-fuchsia-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-fuchsia-300">
            V11.8.1 Strategy Weight Auto-Rebalancing Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Visualisiert automatische Strategie-Gewichtungen aus Learning, Confidence und Institutional Risk.
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
          Strategy Weight Auto-Rebalancing wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Strategy Weight Auto-Rebalancing Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Total Strategies" value={report.totalStrategies} />
            <MetricCard title="Boosted" value={report.boostedStrategies} positive={report.boostedStrategies > 0} />
            <MetricCard title="Reduced" value={report.reducedStrategies} negative={report.reducedStrategies > 0} />
            <MetricCard title="Risk Mode" value={report.institutionalRiskMode} negative={report.institutionalRiskMode === "DEFENSIVE"} positive={report.institutionalRiskMode === "NORMAL"} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Current Weight" value={report.totalCurrentWeight} />
            <MetricCard title="Recommended Weight" value={report.totalRecommendedWeight} />
            <MetricCard title="Total Change" value={totalWeightChange} positive={totalWeightChange > 0} negative={totalWeightChange < 0} />
            <MetricCard title="Defensive Holds" value={report.defensiveHeldStrategies} negative={report.defensiveHeldStrategies > 0} />
          </div>

          <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-fuchsia-300">
              Rebalancing Flow
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Outcome Learning" value="Learning Score" />
              <RouteBox title="Adaptive Confidence" value="Confidence Score" />
              <RouteBox title="Institutional Sync" value="Risk / Bias" />
              <RouteBox title="Weight Engine" value="Auto Calculation" />
              <RouteBox title="Portfolio Brain" value="Next Target" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Strategy Weight Decisions
            </h3>

            <div className="space-y-4">
              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-lg font-bold text-fuchsia-200">
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
                    <Info label="Max Allowed" value={decision.maxAllowedWeight} />
                    <Info label="Learning Score" value={decision.learningScore} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <ScoreCard
                      title="Combined Confidence"
                      value={decision.combinedConfidenceScore}
                      positive={decision.combinedConfidenceScore >= 65}
                      negative={decision.combinedConfidenceScore < 45}
                    />
                    <ScoreCard
                      title="Combined Risk"
                      value={decision.combinedRiskScore}
                      positive={decision.combinedRiskScore < 55}
                      negative={decision.combinedRiskScore >= 70}
                    />
                    <ScoreCard
                      title="Combined Strategy"
                      value={decision.combinedStrategyScore}
                      positive={decision.combinedStrategyScore >= 65}
                      negative={decision.combinedStrategyScore < 45}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <DecisionCard
                      title="Weight Increase"
                      active={decision.allowWeightIncrease}
                      activeText="ALLOWED"
                      inactiveText="BLOCKED"
                    />
                    <DecisionCard
                      title="Weight Reduction"
                      active={decision.requireWeightReduction}
                      activeText="REQUIRED"
                      inactiveText="NOT REQUIRED"
                      reverse
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    {decision.reason}
                  </p>
                </div>
              ))}

              {decisions.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Strategy Weight Decisions vorhanden.
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

function ScoreCard({
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
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{title}</p>
        <p
          className={`text-lg font-bold ${
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

      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-fuchsia-400"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function DecisionCard({
  title,
  active,
  activeText,
  inactiveText,
  reverse,
}: {
  title: string;
  active: boolean;
  activeText: string;
  inactiveText: string;
  reverse?: boolean;
}) {
  const isPositive = reverse ? !active : active;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={`mt-2 text-xl font-bold ${
          isPositive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {active ? activeText : inactiveText}
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
