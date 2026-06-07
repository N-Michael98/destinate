"use client";

import { useEffect, useState } from "react";

type FeedbackItem = {
  id: string;
  symbol?: string;
  pnlAmount?: number;
  pnlPercent?: number;
  confidenceImpact?: number;
  strategyImpact?: number;
  outcome?: string;
  timestamp?: string;
};

type TradeOutcomeFeedbackResponse = {
  ok: boolean;
  tradeOutcomeFeedback?: {
    version: string;
    status: string;
    totalFeedbackItems: number;
    positiveFeedback: number;
    negativeFeedback: number;
    neutralFeedback: number;
    totalPnlAmount: number;
    averagePnlPercent: number;
    totalConfidenceImpact: number;
    totalStrategyImpact: number;
    bestFeedbackItem?: FeedbackItem;
    recentFeedbackItems?: FeedbackItem[];
  };
};

export default function TradeOutcomeFeedbackDashboardPanel() {
  const [data, setData] = useState<TradeOutcomeFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeedback() {
      try {
        const response = await fetch("/api/trade-outcome-feedback-engine", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Trade Outcome Feedback Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFeedback();
  }, []);

  const feedback = data?.tradeOutcomeFeedback;

  return (
    <section className="rounded-2xl border border-cyan-500/30 bg-slate-950/80 p-6 shadow-lg shadow-cyan-500/10">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-cyan-300">
            V11.6.9 Trade Outcome Feedback Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Visualisiert Trade Feedback, PnL Impact und Lernsignale.
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : feedback?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">Trade Outcome Feedback wird geladen...</p>
      )}

      {!loading && !feedback && (
        <p className="text-sm text-red-400">
          Keine Trade Outcome Feedback Daten gefunden.
        </p>
      )}

      {feedback && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Total Feedback" value={feedback.totalFeedbackItems} />
            <MetricCard title="Positive" value={feedback.positiveFeedback} positive />
            <MetricCard title="Negative" value={feedback.negativeFeedback} negative />
            <MetricCard title="Neutral" value={feedback.neutralFeedback} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Total PnL" value={`${feedback.totalPnlAmount}`} positive={feedback.totalPnlAmount >= 0} negative={feedback.totalPnlAmount < 0} />
            <MetricCard title="Average PnL %" value={`${feedback.averagePnlPercent}%`} positive={feedback.averagePnlPercent >= 0} negative={feedback.averagePnlPercent < 0} />
            <MetricCard title="Confidence Impact" value={feedback.totalConfidenceImpact} positive={feedback.totalConfidenceImpact >= 0} negative={feedback.totalConfidenceImpact < 0} />
            <MetricCard title="Strategy Impact" value={feedback.totalStrategyImpact} positive={feedback.totalStrategyImpact >= 0} negative={feedback.totalStrategyImpact < 0} />
          </div>

          {feedback.bestFeedbackItem && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <h3 className="mb-3 text-lg font-bold text-emerald-300">
                Best Trade Feedback
              </h3>

              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <Info label="ID" value={feedback.bestFeedbackItem.id} />
                <Info label="Symbol" value={feedback.bestFeedbackItem.symbol ?? "N/A"} />
                <Info label="Outcome" value={feedback.bestFeedbackItem.outcome ?? "N/A"} />
                <Info label="PnL Amount" value={feedback.bestFeedbackItem.pnlAmount ?? 0} />
                <Info label="PnL %" value={`${feedback.bestFeedbackItem.pnlPercent ?? 0}%`} />
                <Info label="Confidence Impact" value={feedback.bestFeedbackItem.confidenceImpact ?? 0} />
                <Info label="Strategy Impact" value={feedback.bestFeedbackItem.strategyImpact ?? 0} />
                <Info label="Timestamp" value={feedback.bestFeedbackItem.timestamp ?? "N/A"} />
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Recent Feedback Items
            </h3>

            <div className="space-y-3">
              {(feedback.recentFeedbackItems ?? []).map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm md:grid-cols-5"
                >
                  <Info label="Symbol" value={item.symbol ?? "N/A"} />
                  <Info label="PnL" value={`${item.pnlAmount ?? 0} / ${item.pnlPercent ?? 0}%`} />
                  <Info label="Outcome" value={item.outcome ?? "N/A"} />
                  <Info label="Confidence Impact" value={item.confidenceImpact ?? 0} />
                  <Info label="Strategy Impact" value={item.strategyImpact ?? 0} />
                </div>
              ))}

              {(feedback.recentFeedbackItems ?? []).length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Recent Feedback Items vorhanden.
                </p>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Engine Version: {feedback.version}
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
              : "text-cyan-300"
        }`}
      >
        {value}
      </p>
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
