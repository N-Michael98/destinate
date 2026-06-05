"use client";

import React from "react";

type PortfolioBrainOutcomeEntry = {
  id: string;
  memoryId: string;
  createdAt: string;
  decision: string;
  confidence: number;
  riskScore: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
  pnlPercent: number;
  reason: string;
};

type PortfolioBrainOutcomeReport = {
  version: string;
  status: "READY";
  totalOutcomes: number;
  wins: number;
  losses: number;
  breakevens: number;
  openOutcomes: number;
  winRate: number;
  averagePnlPercent: number;
  bestDecisionType: string;
  worstDecisionType: string;
  outcomeQualityScore: number;
  recommendation: string;
  outcomes: PortfolioBrainOutcomeEntry[];
  updatedAt: string;
};

type Props = {
  outcomes: PortfolioBrainOutcomeReport | null;
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

function outcomeAccent(outcome?: string): string {
  if (outcome === "WIN") return "text-green-400";
  if (outcome === "LOSS") return "text-red-400";
  if (outcome === "BREAKEVEN") return "text-yellow-400";
  return "text-cyan-400";
}

export default function PortfolioBrainOutcomePanel({ outcomes }: Props) {
  return (
    <div className="bg-black border border-cyan-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🏁 Portfolio Brain Outcome Panel V11.4.3</h3>
          <p className="text-gray-400 mt-2">
            Outcome-Auswertung aus <span className="text-cyan-400">/api/portfolio-brain-outcomes</span>.
            Verbindet Portfolio-Brain-Memory mit simulierten Trade-Ergebnissen.
          </p>
        </div>

        <div className="bg-gray-950 border border-cyan-800 rounded-xl p-4 min-w-[260px]">
          <p className="text-gray-400">Outcome Quality</p>
          <p
            className={
              (outcomes?.outcomeQualityScore ?? 0) >= 75
                ? "text-green-400 text-3xl font-bold"
                : (outcomes?.outcomeQualityScore ?? 0) >= 50
                  ? "text-yellow-400 text-3xl font-bold"
                  : "text-red-400 text-3xl font-bold"
            }
          >
            {outcomes?.outcomeQualityScore ?? 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard title="Total Outcomes" value={`${outcomes?.totalOutcomes ?? 0}`} subtitle="Tracked brain outcomes" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Win Rate" value={`${outcomes?.winRate ?? 0}%`} subtitle="Closed outcome win rate" accent="text-green-400" border="border-green-900" />
        <StatCard title="Avg PnL" value={`${outcomes?.averagePnlPercent ?? 0}%`} subtitle="Average simulated result" accent={(outcomes?.averagePnlPercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"} border={(outcomes?.averagePnlPercent ?? 0) >= 0 ? "border-green-900" : "border-red-900"} />
        <StatCard title="Best Type" value={outcomes?.bestDecisionType ?? "N/A"} subtitle="Best decision by PnL" accent="text-purple-400" border="border-purple-900" />
        <StatCard title="Worst Type" value={outcomes?.worstDecisionType ?? "N/A"} subtitle="Weakest decision by PnL" accent="text-orange-400" border="border-orange-900" />
      </div>

      <div className="grid grid-cols-4 gap-5 mb-6">
        <StatCard title="Wins" value={`${outcomes?.wins ?? 0}`} subtitle="Positive simulated outcomes" accent="text-green-400" border="border-green-900" />
        <StatCard title="Losses" value={`${outcomes?.losses ?? 0}`} subtitle="Negative simulated outcomes" accent="text-red-400" border="border-red-900" />
        <StatCard title="Breakevens" value={`${outcomes?.breakevens ?? 0}`} subtitle="Neutral outcomes" accent="text-yellow-400" border="border-yellow-900" />
        <StatCard title="Open" value={`${outcomes?.openOutcomes ?? 0}`} subtitle="WAIT/BLOCK or not closed" accent="text-cyan-400" border="border-cyan-900" />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        {(outcomes?.outcomes ?? []).slice(0, 6).map((entry) => (
          <div key={entry.id} className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">{entry.decision}</h4>
              <span className={`font-bold ${outcomeAccent(entry.outcome)}`}>{entry.outcome}</span>
            </div>

            <p className="text-cyan-400 font-bold text-3xl mt-4">
              {entry.pnlPercent}%
            </p>
            <p className="text-gray-400 mt-2">
              Confidence {entry.confidence}% · Risk {entry.riskScore}
            </p>
            <p className="text-gray-500 mt-3 text-sm leading-relaxed">
              {entry.reason}
            </p>
            <p className="text-gray-600 mt-4 text-xs">
              Memory: {entry.memoryId}
            </p>
          </div>
        ))}

        {(outcomes?.outcomes ?? []).length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-3">
            <p className="text-gray-500">No Portfolio Brain outcomes available yet.</p>
          </div>
        )}
      </div>

      <div className="bg-gray-950 border border-cyan-900 rounded-2xl p-5">
        <h4 className="text-xl font-bold">Outcome Recommendation</h4>
        <p className="text-cyan-300 font-bold mt-4 leading-relaxed">
          {outcomes?.recommendation ?? "No outcome recommendation available yet."}
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          Updated: {outcomes?.updatedAt ?? "N/A"}
        </p>
      </div>
    </div>
  );
}
