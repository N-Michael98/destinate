"use client";

import React from "react";

type StrategyOpportunityMatch = {
  rank: number;
  symbol: string;
  displayName: string;
  direction: string;
  regime: string;
  confidence: number;
  riskScore: number;
  opportunityScore: number;
  strategyScore: number;
  selectedStrategy: string;
  strategyCategory: string;
  strategyConfidenceBoost: number;
  executionBias: "AGGRESSIVE" | "NORMAL" | "CAUTIOUS" | "WAIT";
  reason: string;
};

type StrategyOpportunitySyncReport = {
  version: string;
  status: "READY";
  totalOpportunities: number;
  tradableOpportunities: number;
  bestMatch: StrategyOpportunityMatch | null;
  matches: StrategyOpportunityMatch[];
  recommendation: string;
  updatedAt: string;
};

type Props = {
  strategyOpportunitySync: StrategyOpportunitySyncReport | null;
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

function getDirectionAccent(direction: string): string {
  if (direction === "LONG") return "text-green-400";
  if (direction === "SHORT") return "text-red-400";
  return "text-yellow-400";
}

function getBiasAccent(bias: string): string {
  if (bias === "AGGRESSIVE") return "text-green-400";
  if (bias === "NORMAL") return "text-cyan-400";
  if (bias === "CAUTIOUS") return "text-yellow-400";
  return "text-gray-400";
}

function getRegimeAccent(regime: string): string {
  if (regime === "BULLISH") return "text-green-400";
  if (regime === "BEARISH") return "text-red-400";
  if (regime === "VOLATILE") return "text-orange-400";
  return "text-yellow-400";
}

export default function StrategyOpportunityPanel({
  strategyOpportunitySync,
}: Props) {
  const bestMatch = strategyOpportunitySync?.bestMatch ?? null;

  return (
    <div className="bg-black border border-indigo-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🧬 Strategy Opportunity Dashboard V11.4.10</h3>
          <p className="text-gray-400 mt-2">
            Verbindet <span className="text-indigo-400">Opportunity Scanner</span> mit Strategy Evolution.
            Jede Top Opportunity bekommt eine passende Strategie, Confidence Boost und Execution Bias.
          </p>
        </div>

        <div className="bg-gray-950 border border-indigo-800 rounded-xl p-4 min-w-[280px]">
          <p className="text-gray-400">Best Strategy Match</p>
          <p className="text-indigo-400 text-2xl font-bold">
            {bestMatch?.symbol ?? "WAITING"}
          </p>
          <p className="text-gray-500 mt-2">
            {bestMatch?.selectedStrategy ?? "No strategy match yet"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Total Matches"
          value={`${strategyOpportunitySync?.totalOpportunities ?? 0}`}
          subtitle="Top opportunities mapped"
          accent="text-indigo-400"
          border="border-indigo-900"
        />
        <StatCard
          title="Tradable"
          value={`${strategyOpportunitySync?.tradableOpportunities ?? 0}`}
          subtitle="Non-WAIT strategy matches"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Best Confidence"
          value={`${bestMatch?.confidence ?? 0}%`}
          subtitle="Boosted strategy confidence"
          accent={(bestMatch?.confidence ?? 0) >= 70 ? "text-green-400" : "text-yellow-400"}
          border={(bestMatch?.confidence ?? 0) >= 70 ? "border-green-900" : "border-yellow-900"}
        />
        <StatCard
          title="Best Risk"
          value={`${bestMatch?.riskScore ?? 0}`}
          subtitle="Risk score after sync"
          accent={(bestMatch?.riskScore ?? 0) <= 25 ? "text-green-400" : "text-yellow-400"}
          border={(bestMatch?.riskScore ?? 0) <= 25 ? "border-green-900" : "border-yellow-900"}
        />
        <StatCard
          title="Execution Bias"
          value={bestMatch?.executionBias ?? "N/A"}
          subtitle="Strategy execution mode"
          accent={getBiasAccent(bestMatch?.executionBias ?? "WAIT")}
          border="border-cyan-900"
        />
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        {(strategyOpportunitySync?.matches ?? []).map((match) => (
          <div
            key={`${match.rank}-${match.symbol}`}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">#{match.rank} {match.symbol}</h4>
              <span className={`font-bold ${getDirectionAccent(match.direction)}`}>
                {match.direction}
              </span>
            </div>

            <p className={`font-bold mt-3 ${getRegimeAccent(match.regime)}`}>
              {match.regime}
            </p>

            <p className="text-indigo-300 font-bold mt-4 leading-relaxed">
              {match.selectedStrategy}
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-black border border-gray-800 rounded-xl p-3">
                <p className="text-gray-500">Confidence</p>
                <p className="text-cyan-400 font-bold text-xl">{match.confidence}%</p>
              </div>
              <div className="bg-black border border-gray-800 rounded-xl p-3">
                <p className="text-gray-500">Risk</p>
                <p className="text-orange-400 font-bold text-xl">{match.riskScore}</p>
              </div>
            </div>

            <p className={`font-bold mt-4 ${getBiasAccent(match.executionBias)}`}>
              Bias: {match.executionBias}
            </p>

            <p className="text-gray-500 mt-3 text-sm leading-relaxed">
              {match.reason}
            </p>
          </div>
        ))}

        {(strategyOpportunitySync?.matches ?? []).length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-5">
            <p className="text-gray-500">No strategy opportunity matches available yet.</p>
          </div>
        )}
      </div>

      <div className="bg-gray-950 border border-indigo-900 rounded-2xl p-5">
        <h4 className="text-xl font-bold">Strategy Opportunity Recommendation</h4>
        <p className="text-indigo-300 font-bold mt-4 leading-relaxed">
          {strategyOpportunitySync?.recommendation ??
            "No strategy opportunity recommendation available yet."}
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          Updated: {strategyOpportunitySync?.updatedAt ?? "N/A"}
        </p>
      </div>
    </div>
  );
}
