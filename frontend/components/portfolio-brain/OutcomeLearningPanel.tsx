"use client";

import React from "react";

type OutcomeLearningItem = {
  id: string;
  symbol: string;
  strategy: string;
  direction: string;
  confidence: number;
  approved: boolean;
  simulatedOutcome: "WIN" | "LOSS" | "BREAKEVEN" | "NO_TRADE";
  simulatedPnlPercent: number;
  learningImpact: "BOOST" | "PENALTY" | "NEUTRAL";
  confidenceAdjustment: number;
  reason: string;
};

type OutcomeLearningSyncReport = {
  version: string;
  status: "READY";
  totalMemories: number;
  approvedMemories: number;
  rejectedMemories: number;
  wins: number;
  losses: number;
  breakevens: number;
  noTrades: number;
  winRate: number;
  averagePnlPercent: number;
  totalConfidenceAdjustment: number;
  learningState: "IMPROVING" | "CAUTIOUS" | "NEUTRAL";
  bestLearningItem: OutcomeLearningItem | null;
  worstLearningItem: OutcomeLearningItem | null;
  items: OutcomeLearningItem[];
  recommendation: string;
  updatedAt: string;
};

type Props = {
  outcomeLearningSync: OutcomeLearningSyncReport | null;
};

function StatCard({
  title,
  value,
  subtitle,
  accent = "text-blue-400",
  border = "border-blue-900",
}: {
  title: string;
  value: string;
  subtitle: string;
  accent?: string;
  border?: string;
}) {
  return (
    <div className={`bg-gray-950 ${border} border rounded-2xl p-6 min-h-[150px]`}>
      <h3 className="font-bold text-lg text-white">{title}</h3>
      <p className={`text-4xl mt-5 font-semibold ${accent}`}>{value}</p>
      <p className="text-gray-400 mt-3">{subtitle}</p>
    </div>
  );
}

export default function OutcomeLearningPanel({ outcomeLearningSync }: Props) {
  const best = outcomeLearningSync?.bestLearningItem ?? null;
  const worst = outcomeLearningSync?.worstLearningItem ?? null;
  const items = outcomeLearningSync?.items ?? [];

  return (
    <div className="bg-black border border-lime-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">📈 Outcome Learning Panel V11.5.7</h3>
          <p className="text-gray-400 mt-2">
            Portfolio Brain Outcome Learning Sync aus{" "}
            <span className="text-lime-400">
              /api/portfolio-brain-outcome-learning-sync
            </span>
            .
          </p>
        </div>

        <div className="bg-gray-950 border border-lime-800 rounded-xl p-4 min-w-[240px]">
          <p className="text-gray-400">Learning State</p>
          <p
            className={
              outcomeLearningSync?.learningState === "IMPROVING"
                ? "text-green-400 text-3xl font-bold"
                : outcomeLearningSync?.learningState === "CAUTIOUS"
                  ? "text-yellow-400 text-3xl font-bold"
                  : "text-lime-400 text-3xl font-bold"
            }
          >
            {outcomeLearningSync?.learningState ?? "WAITING"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Total Memories"
          value={`${outcomeLearningSync?.totalMemories ?? 0}`}
          subtitle="Decision memories used"
          accent="text-lime-400"
          border="border-lime-900"
        />
        <StatCard
          title="Win Rate"
          value={`${outcomeLearningSync?.winRate ?? 0}%`}
          subtitle="Simulated outcome winrate"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Average PnL"
          value={`${outcomeLearningSync?.averagePnlPercent ?? 0}%`}
          subtitle="Average simulated PnL"
          accent={
            (outcomeLearningSync?.averagePnlPercent ?? 0) >= 0
              ? "text-green-400"
              : "text-red-400"
          }
          border={
            (outcomeLearningSync?.averagePnlPercent ?? 0) >= 0
              ? "border-green-900"
              : "border-red-900"
          }
        />
        <StatCard
          title="Confidence Adj."
          value={`${outcomeLearningSync?.totalConfidenceAdjustment ?? 0}`}
          subtitle="Total learning adjustment"
          accent={
            (outcomeLearningSync?.totalConfidenceAdjustment ?? 0) >= 0
              ? "text-cyan-400"
              : "text-red-400"
          }
          border={
            (outcomeLearningSync?.totalConfidenceAdjustment ?? 0) >= 0
              ? "border-cyan-900"
              : "border-red-900"
          }
        />
        <StatCard
          title="No Trades"
          value={`${outcomeLearningSync?.noTrades ?? 0}`}
          subtitle="WAIT / rejected decisions"
          accent="text-yellow-400"
          border="border-yellow-900"
        />
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Approved"
          value={`${outcomeLearningSync?.approvedMemories ?? 0}`}
          subtitle="Approved memories"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Rejected"
          value={`${outcomeLearningSync?.rejectedMemories ?? 0}`}
          subtitle="Rejected memories"
          accent="text-red-400"
          border="border-red-900"
        />
        <StatCard
          title="Wins"
          value={`${outcomeLearningSync?.wins ?? 0}`}
          subtitle="Simulated wins"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Breakevens"
          value={`${outcomeLearningSync?.breakevens ?? 0}`}
          subtitle="Flat outcomes"
          accent="text-yellow-400"
          border="border-yellow-900"
        />
        <StatCard
          title="Losses"
          value={`${outcomeLearningSync?.losses ?? 0}`}
          subtitle="Simulated losses"
          accent="text-red-400"
          border="border-red-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-gray-950 border border-green-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Best Learning Item</h4>

          {best ? (
            <>
              <p className="text-green-400 text-3xl font-bold mt-4">
                {best.symbol} · {best.simulatedOutcome}
              </p>
              <p className="text-gray-400 mt-3">{best.strategy}</p>
              <p className="text-gray-400 mt-2">
                Direction: {best.direction} · Confidence: {best.confidence}%
              </p>
              <p className="text-green-300 font-bold mt-3">
                PnL: {best.simulatedPnlPercent}% · Impact: {best.learningImpact} ·
                Adjustment: {best.confidenceAdjustment}
              </p>
              <p className="text-gray-500 mt-4 leading-relaxed">{best.reason}</p>
            </>
          ) : (
            <p className="text-gray-500 mt-4">No best learning item available yet.</p>
          )}
        </div>

        <div className="bg-gray-950 border border-yellow-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Worst / Weakest Learning Item</h4>

          {worst ? (
            <>
              <p className="text-yellow-400 text-3xl font-bold mt-4">
                {worst.symbol} · {worst.simulatedOutcome}
              </p>
              <p className="text-gray-400 mt-3">{worst.strategy}</p>
              <p className="text-gray-400 mt-2">
                Direction: {worst.direction} · Confidence: {worst.confidence}%
              </p>
              <p className="text-yellow-300 font-bold mt-3">
                PnL: {worst.simulatedPnlPercent}% · Impact: {worst.learningImpact} ·
                Adjustment: {worst.confidenceAdjustment}
              </p>
              <p className="text-gray-500 mt-4 leading-relaxed">{worst.reason}</p>
            </>
          ) : (
            <p className="text-gray-500 mt-4">No weakest learning item available yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">{item.symbol}</h4>
              <span
                className={
                  item.learningImpact === "BOOST"
                    ? "text-green-400 font-bold"
                    : item.learningImpact === "PENALTY"
                      ? "text-red-400 font-bold"
                      : "text-yellow-400 font-bold"
                }
              >
                {item.learningImpact}
              </span>
            </div>

            <p
              className={
                item.simulatedOutcome === "WIN"
                  ? "text-green-400 text-3xl font-bold mt-4"
                  : item.simulatedOutcome === "LOSS"
                    ? "text-red-400 text-3xl font-bold mt-4"
                    : item.simulatedOutcome === "BREAKEVEN"
                      ? "text-yellow-400 text-3xl font-bold mt-4"
                      : "text-gray-400 text-3xl font-bold mt-4"
              }
            >
              {item.simulatedOutcome}
            </p>

            <p className="text-gray-400 mt-3">{item.strategy}</p>
            <p className="text-gray-400 mt-3">
              PnL: {item.simulatedPnlPercent}%
            </p>
            <p className="text-gray-400 mt-2">
              Adjustment: {item.confidenceAdjustment}
            </p>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-5">
            <p className="text-gray-500">
              No Portfolio Brain outcome learning items available yet.
            </p>
          </div>
        )}
      </div>

      <div className="bg-gray-950 border border-lime-900 rounded-2xl p-5">
        <h4 className="text-xl font-bold">Outcome Learning Recommendation</h4>
        <p className="text-lime-300 font-bold mt-4 leading-relaxed">
          {outcomeLearningSync?.recommendation ??
            "No outcome learning recommendation available yet."}
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          Updated: {outcomeLearningSync?.updatedAt ?? "N/A"}
        </p>
      </div>
    </div>
  );
}