"use client";

import React from "react";

type PortfolioRiskState =
  | "SAFE"
  | "NORMAL"
  | "CAUTIOUS"
  | "DEFENSIVE"
  | "LOCKDOWN";

type PortfolioRiskManagementReport = {
  version: string;
  status: "READY";
  account: {
    currency: string;
    startEquityToday: number;
    currentEquity: number;
    dailyPnl: number;
    dailyLossPercent: number;
    dailyWarningLimitPercent: number;
    dailyHardStopLimitPercent: number;
  };
  risk: {
    riskState: PortfolioRiskState;
    tradingAllowed: boolean;
    newTradesAllowed: boolean;
    manageOpenPositionsAllowed: boolean;
    riskPerTradePercent: number;
    maxRiskPerTradeAmount: number;
    maxPortfolioExposurePercent: number;
    dailyLossLimitReached: boolean;
    dailyHardStopReached: boolean;
  };
  adaptiveInputs: {
    averageAdaptiveConfidence: number;
    totalConfidenceAdjustment: number;
    bestStrategyWeight: number;
    promotedStrategies: number;
    reducedStrategies: number;
  };
  executionRules: {
    unlimitedTradesUntilDailyLimit: boolean;
    requiresAnalysisGo: boolean;
    requiresPositiveRiskState: boolean;
    requiresExposureRoom: boolean;
    requiresDailyLossBelowHardStop: boolean;
  };
  recommendation: string;
  updatedAt: string;
};

type Props = {
  portfolioRiskManagement: PortfolioRiskManagementReport | null;
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

function RulePill({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
      <span className="text-gray-300">{label}</span>
      <span className={enabled ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
        {enabled ? "ON" : "OFF"}
      </span>
    </div>
  );
}

export default function PortfolioRiskManagementPanel({
  portfolioRiskManagement,
}: Props) {
  const account = portfolioRiskManagement?.account ?? null;
  const risk = portfolioRiskManagement?.risk ?? null;
  const adaptiveInputs = portfolioRiskManagement?.adaptiveInputs ?? null;
  const executionRules = portfolioRiskManagement?.executionRules ?? null;

  const riskState = risk?.riskState ?? "WAITING";

  return (
    <div className="bg-black border border-red-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🛡 Portfolio Risk Management Panel V11.6.2</h3>
          <p className="text-gray-400 mt-2">
            Adaptive Portfolio Risk Management aus{" "}
            <span className="text-red-400">/api/portfolio-risk-management</span>.
          </p>
        </div>

        <div className="bg-gray-950 border border-red-800 rounded-xl p-4 min-w-[260px]">
          <p className="text-gray-400">Risk State</p>
          <p
            className={
              riskState === "SAFE"
                ? "text-green-400 text-3xl font-bold"
                : riskState === "NORMAL"
                  ? "text-cyan-400 text-3xl font-bold"
                  : riskState === "CAUTIOUS"
                    ? "text-yellow-400 text-3xl font-bold"
                    : riskState === "DEFENSIVE"
                      ? "text-orange-400 text-3xl font-bold"
                      : riskState === "LOCKDOWN"
                        ? "text-red-400 text-3xl font-bold"
                        : "text-gray-400 text-3xl font-bold"
            }
          >
            {riskState}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Trading Allowed"
          value={risk?.tradingAllowed ? "YES" : "NO"}
          subtitle="Global trade permission"
          accent={risk?.tradingAllowed ? "text-green-400" : "text-red-400"}
          border={risk?.tradingAllowed ? "border-green-900" : "border-red-900"}
        />
        <StatCard
          title="New Trades"
          value={risk?.newTradesAllowed ? "YES" : "NO"}
          subtitle="New trade entries"
          accent={risk?.newTradesAllowed ? "text-green-400" : "text-red-400"}
          border={risk?.newTradesAllowed ? "border-green-900" : "border-red-900"}
        />
        <StatCard
          title="Risk / Trade"
          value={`${risk?.riskPerTradePercent ?? 0}%`}
          subtitle={`${risk?.maxRiskPerTradeAmount ?? 0} ${account?.currency ?? "CHF"} max`}
          accent="text-yellow-400"
          border="border-yellow-900"
        />
        <StatCard
          title="Max Exposure"
          value={`${risk?.maxPortfolioExposurePercent ?? 0}%`}
          subtitle="Portfolio exposure cap"
          accent="text-orange-400"
          border="border-orange-900"
        />
        <StatCard
          title="Daily Loss"
          value={`${account?.dailyLossPercent ?? 0}%`}
          subtitle={`Warning ${account?.dailyWarningLimitPercent ?? 3}% / Stop ${account?.dailyHardStopLimitPercent ?? 5}%`}
          accent={
            risk?.dailyHardStopReached
              ? "text-red-400"
              : risk?.dailyLossLimitReached
                ? "text-orange-400"
                : "text-green-400"
          }
          border={
            risk?.dailyHardStopReached
              ? "border-red-900"
              : risk?.dailyLossLimitReached
                ? "border-orange-900"
                : "border-green-900"
          }
        />
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Start Equity"
          value={`${account?.startEquityToday ?? 0}`}
          subtitle={account?.currency ?? "CHF"}
          accent="text-blue-400"
          border="border-blue-900"
        />
        <StatCard
          title="Current Equity"
          value={`${account?.currentEquity ?? 0}`}
          subtitle={account?.currency ?? "CHF"}
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Daily PnL"
          value={`${account?.dailyPnl ?? 0}`}
          subtitle={account?.currency ?? "CHF"}
          accent={(account?.dailyPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
          border={(account?.dailyPnl ?? 0) >= 0 ? "border-green-900" : "border-red-900"}
        />
        <StatCard
          title="Adaptive Avg"
          value={`${adaptiveInputs?.averageAdaptiveConfidence ?? 0}%`}
          subtitle="Average adaptive confidence"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Best Weight"
          value={`${adaptiveInputs?.bestStrategyWeight ?? 0}`}
          subtitle="Top self-evolution strategy"
          accent="text-purple-400"
          border="border-purple-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bg-gray-950 border border-red-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Daily Loss Protection</h4>
          <div className="space-y-3 mt-4">
            <RulePill
              label="3% Daily Warning Zone"
              enabled={Boolean(risk?.dailyLossLimitReached)}
            />
            <RulePill
              label="5% Daily Hard Stop"
              enabled={Boolean(risk?.dailyHardStopReached)}
            />
            <RulePill
              label="Manage Open Positions"
              enabled={Boolean(risk?.manageOpenPositionsAllowed)}
            />
            <RulePill
              label="New Trades Allowed"
              enabled={Boolean(risk?.newTradesAllowed)}
            />
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Execution Rules</h4>
          <div className="space-y-3 mt-4">
            <RulePill
              label="Unlimited Trades Until Limit"
              enabled={Boolean(executionRules?.unlimitedTradesUntilDailyLimit)}
            />
            <RulePill
              label="Requires Analysis GO"
              enabled={Boolean(executionRules?.requiresAnalysisGo)}
            />
            <RulePill
              label="Requires Positive Risk State"
              enabled={Boolean(executionRules?.requiresPositiveRiskState)}
            />
            <RulePill
              label="Requires Exposure Room"
              enabled={Boolean(executionRules?.requiresExposureRoom)}
            />
            <RulePill
              label="Requires Daily Loss Below Stop"
              enabled={Boolean(executionRules?.requiresDailyLossBelowHardStop)}
            />
          </div>
        </div>

        <div className="bg-gray-950 border border-purple-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Adaptive Risk Inputs</h4>
          <div className="space-y-3 mt-4">
            <RulePill
              label={`Promoted Strategies: ${adaptiveInputs?.promotedStrategies ?? 0}`}
              enabled={(adaptiveInputs?.promotedStrategies ?? 0) > 0}
            />
            <RulePill
              label={`Reduced Strategies: ${adaptiveInputs?.reducedStrategies ?? 0}`}
              enabled={(adaptiveInputs?.reducedStrategies ?? 0) === 0}
            />
            <RulePill
              label={`Total Confidence Adj.: ${adaptiveInputs?.totalConfidenceAdjustment ?? 0}`}
              enabled={(adaptiveInputs?.totalConfidenceAdjustment ?? 0) >= 0}
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-950 border border-red-900 rounded-2xl p-5">
        <h4 className="text-xl font-bold">Risk Management Recommendation</h4>
        <p className="text-red-300 font-bold mt-4 leading-relaxed">
          {portfolioRiskManagement?.recommendation ??
            "No portfolio risk management recommendation available yet."}
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          Updated: {portfolioRiskManagement?.updatedAt ?? "N/A"}
        </p>
      </div>
    </div>
  );
}