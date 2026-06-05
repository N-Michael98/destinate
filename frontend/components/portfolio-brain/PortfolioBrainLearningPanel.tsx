"use client";

import React from "react";

type DecisionStat = {
  decision: string;
  count: number;
  averageConfidence: number;
  averageRiskScore: number;
};

type PortfolioBrainLearning = {
  version: string;
  status: "READY";
  totalMemories: number;
  totalDecisions: number;
  waitDecisions: number;
  longDecisions: number;
  shortDecisions: number;
  blockDecisions: number;
  averageConfidence: number;
  averageRiskScore: number;
  bestDecisionType: string;
  worstDecisionType: string;
  learningScore: number;
  recommendation: string;
  decisionStats: DecisionStat[];
  updatedAt: string;
};

type Props = {
  learning: PortfolioBrainLearning | null;
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

function StatusPill({
  label,
  value,
  accent = "text-lime-400",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
      <span className="text-gray-300">{label}</span>
      <span className={`font-bold text-right ${accent}`}>{value}</span>
    </div>
  );
}

export default function PortfolioBrainLearningPanel({ learning }: Props) {
  const learningScore = learning?.learningScore ?? 0;

  return (
    <div className="bg-black border border-lime-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🧠 Portfolio Brain Learning Panel V11.4.1</h3>
          <p className="text-gray-400 mt-2">
            Learning-Auswertung aus <span className="text-lime-400">/api/portfolio-brain-learning</span>.
            Analysiert Memory, Entscheidungen, Confidence und Risk Score.
          </p>
        </div>

        <div className="bg-gray-950 border border-lime-800 rounded-xl p-4 min-w-[240px]">
          <p className="text-gray-400">Learning Score</p>
          <p
            className={
              learningScore >= 75
                ? "text-green-400 text-3xl font-bold"
                : learningScore >= 50
                  ? "text-yellow-400 text-3xl font-bold"
                  : "text-red-400 text-3xl font-bold"
            }
          >
            {learningScore}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Total Memories"
          value={`${learning?.totalMemories ?? 0}`}
          subtitle="Stored brain memories"
          accent="text-lime-400"
          border="border-lime-900"
        />
        <StatCard
          title="Total Decisions"
          value={`${learning?.totalDecisions ?? 0}`}
          subtitle="Analyzed decisions"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Avg Confidence"
          value={`${learning?.averageConfidence ?? 0}%`}
          subtitle="Decision confidence"
          accent="text-emerald-400"
          border="border-emerald-900"
        />
        <StatCard
          title="Avg Risk"
          value={`${learning?.averageRiskScore ?? 0}`}
          subtitle="Decision risk average"
          accent="text-orange-400"
          border="border-orange-900"
        />
        <StatCard
          title="Best Type"
          value={learning?.bestDecisionType ?? "N/A"}
          subtitle="Most observed decision"
          accent="text-purple-400"
          border="border-purple-900"
        />
      </div>

      <div className="grid grid-cols-4 gap-5 mb-6">
        {(learning?.decisionStats ?? []).map((item) => (
          <div
            key={item.decision}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">{item.decision}</h4>
              <span
                className={
                  item.decision === "LONG"
                    ? "text-green-400 font-bold"
                    : item.decision === "SHORT" || item.decision === "BLOCK"
                      ? "text-red-400 font-bold"
                      : "text-yellow-400 font-bold"
                }
              >
                {item.count}
              </span>
            </div>

            <p className="text-gray-400 mt-4">
              Avg Confidence: {item.averageConfidence}%
            </p>
            <p className="text-gray-400 mt-2">
              Avg Risk: {item.averageRiskScore}
            </p>
          </div>
        ))}

        {(learning?.decisionStats ?? []).length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-4">
            <p className="text-gray-500">No Portfolio Brain learning data available yet.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-5 mb-6">
        <StatusPill
          label="WAIT Decisions"
          value={`${learning?.waitDecisions ?? 0}`}
          accent="text-yellow-400"
        />
        <StatusPill
          label="LONG Decisions"
          value={`${learning?.longDecisions ?? 0}`}
          accent="text-green-400"
        />
        <StatusPill
          label="SHORT Decisions"
          value={`${learning?.shortDecisions ?? 0}`}
          accent="text-red-400"
        />
        <StatusPill
          label="BLOCK Decisions"
          value={`${learning?.blockDecisions ?? 0}`}
          accent="text-red-400"
        />
      </div>

      <div className="bg-gray-950 border border-lime-900 rounded-2xl p-5">
        <h4 className="text-xl font-bold">Learning Recommendation</h4>
        <p className="text-lime-300 font-bold mt-4 leading-relaxed">
          {learning?.recommendation ?? "No learning recommendation available yet."}
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          Worst Type: {learning?.worstDecisionType ?? "N/A"} · Updated: {learning?.updatedAt ?? "N/A"}
        </p>
      </div>
    </div>
  );
}
