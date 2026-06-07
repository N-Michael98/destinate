"use client";

import { useEffect, useState } from "react";

type UnifiedDecisionInput = {
  portfolioBrainMode: string;
  exposureReductions: number;
  exposureIncreases: number;
  strictApprovalItems: number;
  flexibleApprovalItems: number;
  totalCurrentWeight: number;
  totalSyncedWeight: number;
  institutionalConfidenceScore: number;
  institutionalRiskScore: number;
  institutionalStrategyScore: number;
  institutionalBias: string;
  outcomeLearningImprovingStrategies: number;
  outcomeLearningWeakeningStrategies: number;
  adaptiveConfidenceAdjustment: number;
};

type UnifiedPortfolioDecision = {
  finalDecisionMode: string;
  finalConfidenceScore: number;
  finalRiskScore: number;
  finalStrategyScore: number;
  tradingAllowed: boolean;
  aggressiveTradingAllowed: boolean;
  normalTradingAllowed: boolean;
  defensiveTradingRequired: boolean;
  positionSizeMultiplier: number;
  approvalStrictness: string;
  actions: string[];
  reason: string;
};

type PortfolioBrainUnifiedDecisionResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    input: UnifiedDecisionInput;
    decision: UnifiedPortfolioDecision;
    integrationTarget: string[];
    recommendation: string;
    updatedAt: string;
  };
};

export default function PortfolioBrainUnifiedDecisionDashboardPanel() {
  const [data, setData] = useState<PortfolioBrainUnifiedDecisionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUnifiedDecision() {
      try {
        const response = await fetch("/api/portfolio-brain-unified-decision", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Portfolio Brain Unified Decision Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUnifiedDecision();
  }, []);

  const report = data?.report;
  const input = report?.input;
  const decision = report?.decision;
  const targets = report?.integrationTarget ?? [];

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-slate-950/80 p-6 shadow-lg shadow-emerald-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-emerald-300">
            V11.8.5 Portfolio Brain Unified Decision Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Finaler Portfolio Brain Entscheider aus Institutional Risk, Strategy Weights, Learning und Approval-Signalen.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Portfolio Brain Unified Decision wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Portfolio Brain Unified Decision Daten gefunden.
        </p>
      )}

      {report && input && decision && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard
              title="Final Mode"
              value={decision.finalDecisionMode}
              negative={decision.finalDecisionMode === "DEFENSIVE" || decision.finalDecisionMode === "BLOCKED"}
              positive={decision.finalDecisionMode === "AGGRESSIVE"}
            />
            <MetricCard
              title="Trading Allowed"
              value={decision.tradingAllowed ? "YES" : "NO"}
              positive={decision.tradingAllowed}
              negative={!decision.tradingAllowed}
            />
            <MetricCard
              title="Approval Strictness"
              value={decision.approvalStrictness}
              negative={decision.approvalStrictness === "HIGH" || decision.approvalStrictness === "EXTREME"}
              positive={decision.approvalStrictness === "LOW"}
            />
            <MetricCard
              title="Position Multiplier"
              value={decision.positionSizeMultiplier}
              positive={decision.positionSizeMultiplier >= 1}
              negative={decision.positionSizeMultiplier < 1}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ScoreCard
              title="Final Confidence Score"
              value={decision.finalConfidenceScore}
              positive={decision.finalConfidenceScore >= 65}
              negative={decision.finalConfidenceScore < 45}
            />
            <ScoreCard
              title="Final Risk Score"
              value={decision.finalRiskScore}
              positive={decision.finalRiskScore < 55}
              negative={decision.finalRiskScore >= 70}
            />
            <ScoreCard
              title="Final Strategy Score"
              value={decision.finalStrategyScore}
              positive={decision.finalStrategyScore >= 65}
              negative={decision.finalStrategyScore < 45}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DecisionCard
              title="Aggressive Trading"
              active={decision.aggressiveTradingAllowed}
              activeText="ALLOWED"
              inactiveText="BLOCKED"
            />
            <DecisionCard
              title="Normal Trading"
              active={decision.normalTradingAllowed}
              activeText="ALLOWED"
              inactiveText="BLOCKED"
            />
            <DecisionCard
              title="Defensive Trading"
              active={decision.defensiveTradingRequired}
              activeText="REQUIRED"
              inactiveText="NOT REQUIRED"
              reverse
            />
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-emerald-300">
              Unified Decision Flow
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-6">
              <RouteBox title="Learning" value={`${input.outcomeLearningImprovingStrategies} improving`} />
              <RouteBox title="Institutional Risk" value={input.institutionalRiskScore.toString()} />
              <RouteBox title="Strategy Weights" value={`${input.totalCurrentWeight} → ${input.totalSyncedWeight}`} />
              <RouteBox title="Approval" value={`${input.strictApprovalItems} strict`} />
              <RouteBox title="Portfolio Brain" value={decision.finalDecisionMode} />
              <RouteBox title="Execution Gate" value={decision.tradingAllowed ? "OPEN" : "BLOCKED"} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Input Summary
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <Info label="Portfolio Brain Mode" value={input.portfolioBrainMode} />
              <Info label="Exposure Reductions" value={input.exposureReductions} />
              <Info label="Exposure Increases" value={input.exposureIncreases} />
              <Info label="Institutional Bias" value={input.institutionalBias} />
              <Info label="Adaptive Confidence Adj." value={input.adaptiveConfidenceAdjustment} />
              <Info label="Institutional Confidence" value={input.institutionalConfidenceScore} />
              <Info label="Institutional Risk" value={input.institutionalRiskScore} />
              <Info label="Institutional Strategy" value={input.institutionalStrategyScore} />
              <Info label="Improving Strategies" value={input.outcomeLearningImprovingStrategies} />
              <Info label="Weakening Strategies" value={input.outcomeLearningWeakeningStrategies} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Unified Actions
            </h3>

            <div className="flex flex-wrap gap-2">
              {decision.actions.map((action) => (
                <span
                  key={action}
                  className="rounded-full border border-emerald-500/20 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-emerald-200"
                >
                  {action}
                </span>
              ))}
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {decision.reason}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-emerald-300">
              Integration Targets
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              {targets.map((target) => (
                <RouteBox key={target} title={target} value="Connected" />
              ))}
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
              : "text-emerald-300"
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
                : "text-emerald-300"
          }`}
        >
          {value}
        </p>
      </div>

      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-emerald-400"
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
    <div className="rounded-xl border border-emerald-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-emerald-200">{value}</p>
    </div>
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
