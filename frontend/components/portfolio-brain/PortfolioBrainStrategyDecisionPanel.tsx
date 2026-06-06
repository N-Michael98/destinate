"use client";

import React from "react";

type PortfolioBrainStrategyDecision = {
  symbol: string;
  strategy: string;
  direction: string;
  confidence: number;
  executionBias: string;
  approved: boolean;
  reason: string;
};

type PortfolioBrainStrategySyncReport = {
  version: string;
  status: "READY";
  totalStrategies: number;
  approvedStrategies: number;
  bestDecision: PortfolioBrainStrategyDecision | null;
  decisions: PortfolioBrainStrategyDecision[];
  recommendation: string;
  updatedAt: string;
};

type Props = {
  portfolioBrainStrategySync: PortfolioBrainStrategySyncReport | null;
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

function decisionAccent(decision?: PortfolioBrainStrategyDecision | null) {
  if (!decision) return "text-gray-400";
  if (!decision.approved) return "text-red-400";
  if (decision.direction === "LONG") return "text-green-400";
  if (decision.direction === "SHORT") return "text-red-400";
  return "text-yellow-400";
}

function borderAccent(decision?: PortfolioBrainStrategyDecision | null) {
  if (!decision) return "border-gray-800";
  if (!decision.approved) return "border-red-900";
  if (decision.direction === "LONG") return "border-green-900";
  if (decision.direction === "SHORT") return "border-red-900";
  return "border-yellow-900";
}

export default function PortfolioBrainStrategyDecisionPanel({
  portfolioBrainStrategySync,
}: Props) {
  const bestDecision = portfolioBrainStrategySync?.bestDecision ?? null;
  const decisions = portfolioBrainStrategySync?.decisions ?? [];

  return (
    <div className="bg-black border border-rose-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🧠 Portfolio Brain Strategy Decision Panel V11.5.2</h3>
          <p className="text-gray-400 mt-2">
            Portfolio-Brain-Entscheidungen aus{" "}
            <span className="text-rose-400">/api/portfolio-brain-strategy-sync</span>.
            Verbindet Top Opportunities, Strategy Sync und Portfolio Brain Approval.
          </p>
        </div>

        <div className={`bg-gray-950 ${borderAccent(bestDecision)} border rounded-xl p-4 min-w-[260px]`}>
          <p className="text-gray-400">Primary Candidate</p>
          <p className={`text-3xl font-bold ${decisionAccent(bestDecision)}`}>
            {bestDecision?.symbol ?? "WAITING"}
          </p>
          <p className="text-gray-500 mt-2">
            {bestDecision?.direction ?? "No decision yet"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Version"
          value={portfolioBrainStrategySync?.version ?? "N/A"}
          subtitle="Strategy decision sync"
          accent="text-rose-400"
          border="border-rose-900"
        />
        <StatCard
          title="Total Strategies"
          value={`${portfolioBrainStrategySync?.totalStrategies ?? 0}`}
          subtitle="Evaluated candidates"
          accent="text-blue-400"
          border="border-blue-900"
        />
        <StatCard
          title="Approved"
          value={`${portfolioBrainStrategySync?.approvedStrategies ?? 0}`}
          subtitle="Portfolio Brain approvals"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Best Direction"
          value={bestDecision?.direction ?? "N/A"}
          subtitle={bestDecision?.strategy ?? "No strategy selected"}
          accent={decisionAccent(bestDecision)}
          border={borderAccent(bestDecision)}
        />
        <StatCard
          title="Confidence"
          value={`${bestDecision?.confidence ?? 0}%`}
          subtitle={bestDecision?.executionBias ?? "Execution bias"}
          accent={(bestDecision?.confidence ?? 0) >= 70 ? "text-green-400" : "text-yellow-400"}
          border={(bestDecision?.confidence ?? 0) >= 70 ? "border-green-900" : "border-yellow-900"}
        />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bg-gray-950 border border-rose-900 rounded-2xl p-5 col-span-2">
          <h4 className="text-xl font-bold">🏆 Best Portfolio Brain Strategy Decision</h4>

          {bestDecision ? (
            <div className="mt-4 bg-black border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-rose-300 font-bold text-2xl">{bestDecision.symbol}</p>
                  <p className="text-gray-400 mt-1">{bestDecision.strategy}</p>
                </div>
                <span className={`font-bold text-2xl ${decisionAccent(bestDecision)}`}>
                  {bestDecision.direction}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-5">
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Approved</p>
                  <p className={bestDecision.approved ? "text-green-400 font-bold text-xl" : "text-red-400 font-bold text-xl"}>
                    {bestDecision.approved ? "YES" : "NO"}
                  </p>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Confidence</p>
                  <p className="text-yellow-400 font-bold text-xl">{bestDecision.confidence}%</p>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Execution Bias</p>
                  <p className="text-cyan-400 font-bold text-xl">{bestDecision.executionBias}</p>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Direction</p>
                  <p className={`font-bold text-xl ${decisionAccent(bestDecision)}`}>{bestDecision.direction}</p>
                </div>
              </div>

              <p className="text-gray-400 mt-5 leading-relaxed">{bestDecision.reason}</p>
            </div>
          ) : (
            <p className="text-gray-500 mt-4">No approved Portfolio Brain strategy decision available yet.</p>
          )}
        </div>

        <div className="bg-gray-950 border border-rose-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">💡 Brain Recommendation</h4>
          <p className="text-rose-300 font-bold mt-4 leading-relaxed">
            {portfolioBrainStrategySync?.recommendation ??
              "No Portfolio Brain strategy recommendation available yet."}
          </p>
          <p className="text-gray-500 mt-4 text-sm">
            Updated: {portfolioBrainStrategySync?.updatedAt ?? "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {decisions.slice(0, 5).map((decision, index) => (
          <div
            key={`${decision.symbol}-${index}`}
            className={`bg-gray-950 ${borderAccent(decision)} border rounded-2xl p-5`}
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">#{index + 1} {decision.symbol}</h4>
              <span className={`font-bold ${decisionAccent(decision)}`}>
                {decision.direction}
              </span>
            </div>

            <p className="text-rose-300 font-bold mt-4 min-h-[48px]">
              {decision.strategy}
            </p>

            <div className="space-y-2 mt-4">
              <p className="text-gray-400">Confidence: {decision.confidence}%</p>
              <p className="text-gray-400">Bias: {decision.executionBias}</p>
              <p className={decision.approved ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                {decision.approved ? "APPROVED" : "REJECTED"}
              </p>
            </div>

            <p className="text-gray-500 mt-4 text-sm leading-relaxed">
              {decision.reason}
            </p>
          </div>
        ))}

        {decisions.length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-5">
            <p className="text-gray-500">No Portfolio Brain strategy decisions available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
