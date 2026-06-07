"use client";

import { useEffect, useState } from "react";

type LearningFeedbackSignal = {
  id: string;
  sourceFeedbackId: string;
  symbol: string;
  strategy: string;
  direction: string;
  outcome: string;
  pnlAmount: number;
  pnlPercent: number;
  learningType: string;
  confidenceAdjustment: number;
  strategyAdjustment: number;
  actions: string[];
  shouldUpdateOutcomeLearning: boolean;
  shouldUpdateAdaptiveConfidence: boolean;
  shouldUpdateSelfEvolution: boolean;
  priority: string;
  reason: string;
  createdAt: string;
};

type LearningFeedbackResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalSignals: number;
    positiveSignals: number;
    negativeSignals: number;
    neutralSignals: number;
    totalConfidenceAdjustment: number;
    totalStrategyAdjustment: number;
    outcomeLearningUpdates: number;
    adaptiveConfidenceUpdates: number;
    selfEvolutionUpdates: number;
    signals: LearningFeedbackSignal[];
    recommendation: string;
    updatedAt: string;
  };
};

export default function LearningFeedbackDashboardPanel() {
  const [data, setData] = useState<LearningFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLearningFeedback() {
      try {
        const response = await fetch("/api/learning-feedback-integration", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Learning Feedback Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadLearningFeedback();
  }, []);

  const report = data?.report;
  const signals = report?.signals ?? [];

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-slate-950/80 p-6 shadow-lg shadow-violet-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-violet-300">
            V11.7.1 Learning Feedback Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Verbindet Trade Outcome Feedback mit Outcome Learning, Adaptive Confidence und Self Evolution.
          </p>
        </div>

        <div className="rounded-xl border border-violet-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">Learning Feedback wird geladen...</p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Learning Feedback Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Total Signals" value={report.totalSignals} />
            <MetricCard title="Positive" value={report.positiveSignals} positive />
            <MetricCard title="Negative" value={report.negativeSignals} negative />
            <MetricCard title="Neutral" value={report.neutralSignals} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <MetricCard title="Confidence Adj." value={report.totalConfidenceAdjustment} positive={report.totalConfidenceAdjustment >= 0} negative={report.totalConfidenceAdjustment < 0} />
            <MetricCard title="Strategy Adj." value={report.totalStrategyAdjustment} positive={report.totalStrategyAdjustment >= 0} negative={report.totalStrategyAdjustment < 0} />
            <MetricCard title="Outcome Learning" value={report.outcomeLearningUpdates} positive />
            <MetricCard title="Adaptive Confidence" value={report.adaptiveConfidenceUpdates} positive />
            <MetricCard title="Self Evolution" value={report.selfEvolutionUpdates} />
          </div>

          <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-violet-300">
              Learning Feedback Route
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
              <RouteBox title="Trade Outcome Feedback" value="Source" />
              <RouteBox title="Outcome Learning" value={`${report.outcomeLearningUpdates} updates`} />
              <RouteBox title="Adaptive Confidence" value={`${report.adaptiveConfidenceUpdates} updates`} />
              <RouteBox title="Self Evolution" value={`${report.selfEvolutionUpdates} reviews`} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Learning Signals
            </h3>

            <div className="space-y-3">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <Info label="Symbol" value={signal.symbol} />
                    <Info label="Strategy" value={signal.strategy} />
                    <Info label="Outcome" value={signal.outcome} />
                    <Info label="Learning Type" value={signal.learningType} />
                    <Info label="Priority" value={signal.priority} />
                    <Info label="PnL" value={`${signal.pnlAmount} / ${signal.pnlPercent}%`} />
                    <Info label="Confidence Adj." value={signal.confidenceAdjustment} />
                    <Info label="Strategy Adj." value={signal.strategyAdjustment} />
                    <Info label="Outcome Learning" value={signal.shouldUpdateOutcomeLearning ? "YES" : "NO"} />
                    <Info label="Adaptive Confidence" value={signal.shouldUpdateAdaptiveConfidence ? "YES" : "NO"} />
                    <Info label="Self Evolution" value={signal.shouldUpdateSelfEvolution ? "YES" : "NO"} />
                    <Info label="Created At" value={signal.createdAt} />
                  </div>

                  <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 p-3">
                    <p className="text-xs text-slate-500">Actions</p>
                    <p className="mt-1 text-xs font-semibold text-violet-200">
                      {signal.actions.join(" → ")}
                    </p>
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    {signal.reason}
                  </p>
                </div>
              ))}

              {signals.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Learning Signals vorhanden.
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
              : "text-violet-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-violet-200">{value}</p>
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
