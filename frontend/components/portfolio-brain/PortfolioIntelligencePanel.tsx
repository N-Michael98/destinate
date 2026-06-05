"use client";

import React from "react";

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
  accent = "text-green-400",
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

type PortfolioExposure = {
  assetClass: string;
  exposurePercent: number;
  riskLevel: string;
};

type PortfolioCorrelation = {
  pair: string;
  correlationRisk: string;
  reason: string;
};

type PortfolioPosition = {
  id: string;
  market: string;
  assetClass: string;
  direction: string;
  allocationPercent: number;
  riskPercent: number;
};

type PortfolioAllocation = {
  market: string;
  suggestedAllocationPercent: number;
  reason: string;
};

type PortfolioIntelligenceReport = {
  version: string;
  exposure: PortfolioExposure[];
  correlationRisk: PortfolioCorrelation[];
  positions: PortfolioPosition[];
  allocationPlan: PortfolioAllocation[];
  summary: {
    portfolioRiskScore: number;
    portfolioHealth: number;
    concentrationScore: number;
    portfolioRisk: string;
    totalPositions: number;
    diversificationScore: number;
    highestExposureAssetClass: string | null;
    highestExposurePercent: number;
    highCorrelationPairs: number;
    mediumCorrelationPairs: number;
    totalSuggestedAllocation: number;
    aiRecommendation: string;
    updatedAt: string;
  };
  roadmap: {
    currentPhase: string;
    nextSteps: string[];
  };
  generatedAt: string;
};

type PortfolioIntelligencePanelProps = {
  portfolioIntelligence: PortfolioIntelligenceReport | null;
};

export default function PortfolioIntelligencePanel({
  portfolioIntelligence,
}: PortfolioIntelligencePanelProps) {
  return (
    <div className="bg-black border border-purple-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">
            Portfolio Intelligence Panel V11.3.4
          </h3>
          <p className="text-gray-400 mt-2">
            Live Portfolio Intelligence aus{" "}
            <span className="text-purple-400">/api/portfolio-intelligence</span>.
            Überwacht Exposure, Konzentration, Korrelation, Allocation und
            Portfolio Health.
          </p>
        </div>

        <div className="bg-gray-950 border border-purple-800 rounded-xl p-4 min-w-[260px]">
          <p className="text-gray-400">Portfolio Version</p>
          <p className="text-purple-400 text-3xl font-bold">
            {portfolioIntelligence?.version ?? "WAITING"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Risk Score"
          value={`${portfolioIntelligence?.summary?.portfolioRiskScore ?? 0}`}
          subtitle="Total portfolio risk"
          accent={
            (portfolioIntelligence?.summary?.portfolioRiskScore ?? 0) >= 70
              ? "text-red-400"
              : (portfolioIntelligence?.summary?.portfolioRiskScore ?? 0) >= 40
                ? "text-yellow-400"
                : "text-green-400"
          }
          border={
            (portfolioIntelligence?.summary?.portfolioRiskScore ?? 0) >= 70
              ? "border-red-900"
              : (portfolioIntelligence?.summary?.portfolioRiskScore ?? 0) >= 40
                ? "border-yellow-900"
                : "border-green-900"
          }
        />
        <StatCard
          title="Portfolio Health"
          value={`${portfolioIntelligence?.summary?.portfolioHealth ?? 0}`}
          subtitle="Diversification and safety"
          accent={
            (portfolioIntelligence?.summary?.portfolioHealth ?? 0) >= 75
              ? "text-green-400"
              : (portfolioIntelligence?.summary?.portfolioHealth ?? 0) >= 50
                ? "text-yellow-400"
                : "text-red-400"
          }
          border={
            (portfolioIntelligence?.summary?.portfolioHealth ?? 0) >= 75
              ? "border-green-900"
              : (portfolioIntelligence?.summary?.portfolioHealth ?? 0) >= 50
                ? "border-yellow-900"
                : "border-red-900"
          }
        />
        <StatCard
          title="Concentration"
          value={`${portfolioIntelligence?.summary?.concentrationScore ?? 0}`}
          subtitle="Largest exposure pressure"
          accent={
            (portfolioIntelligence?.summary?.concentrationScore ?? 0) >= 70
              ? "text-red-400"
              : (portfolioIntelligence?.summary?.concentrationScore ?? 0) >= 50
                ? "text-yellow-400"
                : "text-green-400"
          }
          border={
            (portfolioIntelligence?.summary?.concentrationScore ?? 0) >= 70
              ? "border-red-900"
              : (portfolioIntelligence?.summary?.concentrationScore ?? 0) >= 50
                ? "border-yellow-900"
                : "border-green-900"
          }
        />
        <StatCard
          title="Portfolio Risk"
          value={portfolioIntelligence?.summary?.portfolioRisk ?? "N/A"}
          subtitle="Risk level"
          accent={
            portfolioIntelligence?.summary?.portfolioRisk === "HIGH"
              ? "text-red-400"
              : portfolioIntelligence?.summary?.portfolioRisk === "MEDIUM"
                ? "text-yellow-400"
                : "text-green-400"
          }
          border={
            portfolioIntelligence?.summary?.portfolioRisk === "HIGH"
              ? "border-red-900"
              : portfolioIntelligence?.summary?.portfolioRisk === "MEDIUM"
                ? "border-yellow-900"
                : "border-green-900"
          }
        />
        <StatCard
          title="Positions"
          value={`${portfolioIntelligence?.summary?.totalPositions ?? 0}`}
          subtitle="Portfolio positions"
          accent="text-purple-400"
          border="border-purple-900"
        />
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Diversification"
          value={`${portfolioIntelligence?.summary?.diversificationScore ?? 0}`}
          subtitle="Asset spread score"
          accent="text-emerald-400"
          border="border-emerald-900"
        />
        <StatCard
          title="Highest Exposure"
          value={portfolioIntelligence?.summary?.highestExposureAssetClass ?? "N/A"}
          subtitle={`${portfolioIntelligence?.summary?.highestExposurePercent ?? 0}% largest class`}
          accent="text-orange-400"
          border="border-orange-900"
        />
        <StatCard
          title="High Corr."
          value={`${portfolioIntelligence?.summary?.highCorrelationPairs ?? 0}`}
          subtitle="High correlation pairs"
          accent="text-red-400"
          border="border-red-900"
        />
        <StatCard
          title="Medium Corr."
          value={`${portfolioIntelligence?.summary?.mediumCorrelationPairs ?? 0}`}
          subtitle="Medium correlation pairs"
          accent="text-yellow-400"
          border="border-yellow-900"
        />
        <StatCard
          title="Allocation Total"
          value={`${portfolioIntelligence?.summary?.totalSuggestedAllocation ?? 0}%`}
          subtitle="Suggested allocation sum"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Exposure Breakdown</h4>
          <div className="space-y-3 mt-4">
            {(portfolioIntelligence?.exposure ?? []).map((item: PortfolioExposure) => (
              <StatusPill
                key={item.assetClass}
                label={item.assetClass}
                value={`${item.exposurePercent}% - ${item.riskLevel}`}
                accent={
                  item.riskLevel === "HIGH"
                    ? "text-red-400"
                    : item.riskLevel === "MEDIUM"
                      ? "text-yellow-400"
                      : "text-green-400"
                }
              />
            ))}

            {(portfolioIntelligence?.exposure ?? []).length === 0 && (
              <p className="text-gray-500">No portfolio exposure available yet.</p>
            )}
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Correlation Risk</h4>
          <div className="space-y-3 mt-4">
            {(portfolioIntelligence?.correlationRisk ?? []).map((item: PortfolioCorrelation) => (
              <div
                key={item.pair}
                className="bg-black border border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-purple-300 font-bold">{item.pair}</p>
                  <span
                    className={
                      item.correlationRisk === "HIGH"
                        ? "text-red-400 font-bold"
                        : item.correlationRisk === "MEDIUM"
                          ? "text-yellow-400 font-bold"
                          : "text-green-400 font-bold"
                    }
                  >
                    {item.correlationRisk}
                  </span>
                </div>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  {item.reason}
                </p>
              </div>
            ))}

            {(portfolioIntelligence?.correlationRisk ?? []).length === 0 && (
              <p className="text-gray-500">No correlation risk available yet.</p>
            )}
          </div>
        </div>

        <div className="bg-gray-950 border border-purple-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">AI Portfolio Recommendation</h4>
          <p className="text-purple-300 font-bold mt-4 leading-relaxed">
            {portfolioIntelligence?.summary?.aiRecommendation ??
              "No portfolio recommendation available yet."}
          </p>
          <p className="text-gray-500 mt-4 text-sm">
            Updated: {portfolioIntelligence?.summary?.updatedAt ?? "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-6">
        {(portfolioIntelligence?.positions ?? []).map((position: PortfolioPosition) => (
          <div
            key={position.id}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">{position.market}</h4>
              <span
                className={
                  position.direction === "LONG"
                    ? "text-green-400 font-bold"
                    : position.direction === "SHORT"
                      ? "text-red-400 font-bold"
                      : "text-gray-400 font-bold"
                }
              >
                {position.direction}
              </span>
            </div>

            <p className="text-purple-400 font-bold mt-4">{position.assetClass}</p>
            <p className="text-4xl font-black text-white mt-4">
              {position.allocationPercent}%
            </p>
            <p className="text-gray-500 mt-2">
              Risk {position.riskPercent}% - {position.id}
            </p>
          </div>
        ))}

        {(portfolioIntelligence?.positions ?? []).length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-4">
            <p className="text-gray-500">No portfolio positions available yet.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Allocation Plan</h4>
          <div className="space-y-3 mt-4">
            {(portfolioIntelligence?.allocationPlan ?? []).map((item: PortfolioAllocation) => (
              <div
                key={item.market}
                className="bg-black border border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-cyan-300 font-bold">{item.market}</p>
                  <span className="text-cyan-400 font-bold">
                    {item.suggestedAllocationPercent}%
                  </span>
                </div>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  {item.reason}
                </p>
              </div>
            ))}

            {(portfolioIntelligence?.allocationPlan ?? []).length === 0 && (
              <p className="text-gray-500">No allocation plan available yet.</p>
            )}
          </div>
        </div>

        <div className="bg-gray-950 border border-purple-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Portfolio Roadmap</h4>
          <p className="text-purple-300 font-bold mt-4">
            {portfolioIntelligence?.roadmap?.currentPhase ?? "Waiting"}
          </p>

          <div className="space-y-3 mt-4">
            {(portfolioIntelligence?.roadmap?.nextSteps ?? []).map((step: string) => (
              <StatusPill
                key={step}
                label="Next"
                value={step}
                accent="text-purple-400"
              />
            ))}

            {(portfolioIntelligence?.roadmap?.nextSteps ?? []).length === 0 && (
              <p className="text-gray-500">No portfolio roadmap available yet.</p>
            )}
          </div>

          <p className="text-gray-500 mt-5 text-sm">
            Generated: {portfolioIntelligence?.generatedAt ?? "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
