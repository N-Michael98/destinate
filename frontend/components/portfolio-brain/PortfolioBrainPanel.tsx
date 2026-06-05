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

type PortfolioBrainInput = {
  source: string;
  signal: string;
  confidence: number;
  riskScore: number;
  reason: string;
};

type PortfolioBrainReport = {
  version: string;
  status: string;
  mode: string;
  inputs: PortfolioBrainInput[];
  decision: {
    approved: boolean;
    finalDecision: string;
    confidence: number;
    averageConfidence: number;
    averageRiskScore: number;
    agreementScore: number;
    riskLevel: string;
    explanation: string;
  };
  safety: {
    safe: boolean;
    safetyScore: number;
    blockReason: string | null;
    maxRiskAllowed: number;
  };
  recommendation: string;
  liveTradingEnabled: boolean;
  generatedAt: string;
};

type PortfolioBrainPanelProps = {
  portfolioBrain: PortfolioBrainReport | null;
};

export default function PortfolioBrainPanel({
  portfolioBrain,
}: PortfolioBrainPanelProps) {
  return (
    <div className="bg-black border border-emerald-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">Portfolio Brain Panel V11.3.4</h3>
          <p className="text-gray-400 mt-2">
            Live Portfolio Brain aus{" "}
            <span className="text-emerald-400">/api/portfolio-brain</span>.
            Kombiniert GPT, Claude, Agent, Market Regime und Portfolio
            Intelligence zu einer finalen Safety-Entscheidung.
          </p>
        </div>

        <div className="bg-gray-950 border border-emerald-800 rounded-xl p-4 min-w-[260px]">
          <p className="text-gray-400">Brain Decision</p>
          <p
            className={
              portfolioBrain?.decision?.finalDecision === "LONG"
                ? "text-green-400 text-3xl font-bold"
                : portfolioBrain?.decision?.finalDecision === "SHORT"
                  ? "text-red-400 text-3xl font-bold"
                  : portfolioBrain?.decision?.finalDecision === "BLOCK"
                    ? "text-red-400 text-3xl font-bold"
                    : "text-yellow-400 text-3xl font-bold"
            }
          >
            {portfolioBrain?.decision?.finalDecision ?? "WAITING"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Brain Confidence"
          value={`${portfolioBrain?.decision?.confidence ?? 0}`}
          subtitle="Final brain confidence"
          accent={
            (portfolioBrain?.decision?.confidence ?? 0) >= 75
              ? "text-green-400"
              : (portfolioBrain?.decision?.confidence ?? 0) >= 50
                ? "text-yellow-400"
                : "text-red-400"
          }
          border={
            (portfolioBrain?.decision?.confidence ?? 0) >= 75
              ? "border-green-900"
              : (portfolioBrain?.decision?.confidence ?? 0) >= 50
                ? "border-yellow-900"
                : "border-red-900"
          }
        />
        <StatCard
          title="Agreement"
          value={`${portfolioBrain?.decision?.agreementScore ?? 0}%`}
          subtitle="Source agreement"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Average Risk"
          value={`${portfolioBrain?.decision?.averageRiskScore ?? 0}`}
          subtitle="Brain risk average"
          accent={
            (portfolioBrain?.decision?.averageRiskScore ?? 0) >= 65
              ? "text-red-400"
              : (portfolioBrain?.decision?.averageRiskScore ?? 0) >= 35
                ? "text-yellow-400"
                : "text-green-400"
          }
          border={
            (portfolioBrain?.decision?.averageRiskScore ?? 0) >= 65
              ? "border-red-900"
              : (portfolioBrain?.decision?.averageRiskScore ?? 0) >= 35
                ? "border-yellow-900"
                : "border-green-900"
          }
        />
        <StatCard
          title="Risk Level"
          value={portfolioBrain?.decision?.riskLevel ?? "N/A"}
          subtitle="Brain risk state"
          accent={
            portfolioBrain?.decision?.riskLevel === "EXTREME" ||
            portfolioBrain?.decision?.riskLevel === "HIGH"
              ? "text-red-400"
              : portfolioBrain?.decision?.riskLevel === "MEDIUM"
                ? "text-yellow-400"
                : "text-green-400"
          }
          border={
            portfolioBrain?.decision?.riskLevel === "EXTREME" ||
            portfolioBrain?.decision?.riskLevel === "HIGH"
              ? "border-red-900"
              : portfolioBrain?.decision?.riskLevel === "MEDIUM"
                ? "border-yellow-900"
                : "border-green-900"
          }
        />
        <StatCard
          title="Safety"
          value={portfolioBrain?.safety?.safe ? "SAFE" : "BLOCKED"}
          subtitle={`Safety score ${portfolioBrain?.safety?.safetyScore ?? 0}`}
          accent={portfolioBrain?.safety?.safe ? "text-green-400" : "text-red-400"}
          border={portfolioBrain?.safety?.safe ? "border-green-900" : "border-red-900"}
        />
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Average Conf."
          value={`${portfolioBrain?.decision?.averageConfidence ?? 0}`}
          subtitle="Source confidence average"
          accent="text-emerald-400"
          border="border-emerald-900"
        />
        <StatCard
          title="Max Risk"
          value={`${portfolioBrain?.safety?.maxRiskAllowed ?? 0}%`}
          subtitle="Allowed simulation risk"
          accent="text-orange-400"
          border="border-orange-900"
        />
        <StatCard
          title="Mode"
          value={portfolioBrain?.mode ?? "SIMULATION"}
          subtitle="Brain operating mode"
          accent="text-purple-400"
          border="border-purple-900"
        />
        <StatCard
          title="Sources"
          value={`${portfolioBrain?.inputs?.length ?? 0}`}
          subtitle="Brain input sources"
          accent="text-blue-400"
          border="border-blue-900"
        />
        <StatCard
          title="Live Trading"
          value={portfolioBrain?.liveTradingEnabled ? "ON" : "OFF"}
          subtitle="Safety locked"
          accent={portfolioBrain?.liveTradingEnabled ? "text-green-400" : "text-red-400"}
          border={portfolioBrain?.liveTradingEnabled ? "border-green-900" : "border-red-900"}
        />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Brain Inputs</h4>
          <div className="space-y-3 mt-4">
            {(portfolioBrain?.inputs ?? []).map((item: PortfolioBrainInput) => (
              <div
                key={item.source}
                className="bg-black border border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-emerald-300 font-bold">{item.source}</p>
                  <span
                    className={
                      item.signal === "LONG"
                        ? "text-green-400 font-bold"
                        : item.signal === "SHORT"
                          ? "text-red-400 font-bold"
                          : item.signal === "BLOCK"
                            ? "text-red-400 font-bold"
                            : "text-yellow-400 font-bold"
                    }
                  >
                    {item.signal}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <StatusPill
                    label="Confidence"
                    value={`${item.confidence}%`}
                    accent="text-cyan-400"
                  />
                  <StatusPill
                    label="Risk"
                    value={`${item.riskScore}`}
                    accent={
                      item.riskScore >= 65
                        ? "text-red-400"
                        : item.riskScore >= 35
                          ? "text-yellow-400"
                          : "text-green-400"
                    }
                  />
                </div>

                <p className="text-gray-500 mt-3 text-sm leading-relaxed">
                  {item.reason}
                </p>
              </div>
            ))}

            {(portfolioBrain?.inputs ?? []).length === 0 && (
              <p className="text-gray-500">
                No portfolio brain inputs available yet.
              </p>
            )}
          </div>
        </div>

        <div className="bg-gray-950 border border-emerald-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Brain Recommendation</h4>
          <p className="text-emerald-300 font-bold mt-4 leading-relaxed">
            {portfolioBrain?.recommendation ??
              "No portfolio brain recommendation available yet."}
          </p>

          <div className="space-y-3 mt-5">
            <StatusPill
              label="Approved"
              value={portfolioBrain?.decision?.approved ? "YES" : "NO"}
              accent={portfolioBrain?.decision?.approved ? "text-green-400" : "text-red-400"}
            />
            <StatusPill
              label="Safety"
              value={portfolioBrain?.safety?.safe ? "SAFE" : "BLOCKED"}
              accent={portfolioBrain?.safety?.safe ? "text-green-400" : "text-red-400"}
            />
            <StatusPill
              label="Block Reason"
              value={portfolioBrain?.safety?.blockReason ?? "None"}
              accent={portfolioBrain?.safety?.blockReason ? "text-red-400" : "text-green-400"}
            />
          </div>

          <p className="text-gray-500 mt-5 leading-relaxed">
            {portfolioBrain?.decision?.explanation ??
              "No brain decision explanation available yet."}
          </p>

          <p className="text-gray-500 mt-4 text-sm">
            Generated: {portfolioBrain?.generatedAt ?? "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
