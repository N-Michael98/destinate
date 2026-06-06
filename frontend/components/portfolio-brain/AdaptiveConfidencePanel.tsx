"use client";

import React from "react";

type AdaptiveConfidenceItem = {
  symbol: string;
  strategy: string;
  direction: string;
  baseConfidence: number;
  learningImpact: "BOOST" | "PENALTY" | "NEUTRAL" | "NONE";
  confidenceAdjustment: number;
  adaptiveConfidence: number;
  confidenceState: "AGGRESSIVE" | "NORMAL" | "CAUTIOUS" | "WAIT";
  approved: boolean;
  reason: string;
};

type AdaptiveConfidenceReport = {
  version: string;
  status: "READY";
  totalItems: number;
  approvedItems: number;
  averageBaseConfidence: number;
  averageAdaptiveConfidence: number;
  totalAdjustment: number;
  bestAdaptiveItem: AdaptiveConfidenceItem | null;
  weakestAdaptiveItem: AdaptiveConfidenceItem | null;
  items: AdaptiveConfidenceItem[];
  recommendation: string;
  updatedAt: string;
};

type Props = {
  adaptiveConfidence: AdaptiveConfidenceReport | null;
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

export default function AdaptiveConfidencePanel({ adaptiveConfidence }: Props) {
  const best = adaptiveConfidence?.bestAdaptiveItem ?? null;
  const weakest = adaptiveConfidence?.weakestAdaptiveItem ?? null;
  const items = adaptiveConfidence?.items ?? [];

  return (
    <div className="bg-black border border-cyan-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🧬 Adaptive Confidence Panel V11.5.9</h3>
          <p className="text-gray-400 mt-2">
            Portfolio Brain Adaptive Confidence aus{" "}
            <span className="text-cyan-400">
              /api/portfolio-brain-adaptive-confidence
            </span>
            .
          </p>
        </div>

        <div className="bg-gray-950 border border-cyan-800 rounded-xl p-4 min-w-[260px]">
          <p className="text-gray-400">Best Adaptive Candidate</p>
          <p className="text-cyan-400 text-3xl font-bold">
            {best ? `${best.symbol} ${best.adaptiveConfidence}%` : "WAITING"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Total Items"
          value={`${adaptiveConfidence?.totalItems ?? 0}`}
          subtitle="Adaptive candidates"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Approved"
          value={`${adaptiveConfidence?.approvedItems ?? 0}`}
          subtitle="Tradable candidates"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Base Avg"
          value={`${adaptiveConfidence?.averageBaseConfidence ?? 0}%`}
          subtitle="Average base confidence"
          accent="text-blue-400"
          border="border-blue-900"
        />
        <StatCard
          title="Adaptive Avg"
          value={`${adaptiveConfidence?.averageAdaptiveConfidence ?? 0}%`}
          subtitle="After learning adjustment"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Total Adj."
          value={`${adaptiveConfidence?.totalAdjustment ?? 0}`}
          subtitle="Learning confidence delta"
          accent={
            (adaptiveConfidence?.totalAdjustment ?? 0) >= 0
              ? "text-green-400"
              : "text-red-400"
          }
          border={
            (adaptiveConfidence?.totalAdjustment ?? 0) >= 0
              ? "border-green-900"
              : "border-red-900"
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-gray-950 border border-green-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Best Adaptive Item</h4>

          {best ? (
            <>
              <p className="text-green-400 text-4xl font-bold mt-4">
                {best.symbol} · {best.adaptiveConfidence}%
              </p>
              <p className="text-gray-400 mt-3">{best.strategy}</p>
              <p className="text-gray-400 mt-2">
                Base: {best.baseConfidence}% · Adjustment: {best.confidenceAdjustment}
              </p>
              <p className="text-cyan-300 font-bold mt-3">
                {best.direction} · {best.learningImpact} · {best.confidenceState}
              </p>
              <p className="text-gray-500 mt-4 leading-relaxed">{best.reason}</p>
            </>
          ) : (
            <p className="text-gray-500 mt-4">No best adaptive item available yet.</p>
          )}
        </div>

        <div className="bg-gray-950 border border-yellow-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Weakest Adaptive Item</h4>

          {weakest ? (
            <>
              <p className="text-yellow-400 text-4xl font-bold mt-4">
                {weakest.symbol} · {weakest.adaptiveConfidence}%
              </p>
              <p className="text-gray-400 mt-3">{weakest.strategy}</p>
              <p className="text-gray-400 mt-2">
                Base: {weakest.baseConfidence}% · Adjustment: {weakest.confidenceAdjustment}
              </p>
              <p className="text-yellow-300 font-bold mt-3">
                {weakest.direction} · {weakest.learningImpact} · {weakest.confidenceState}
              </p>
              <p className="text-gray-500 mt-4 leading-relaxed">{weakest.reason}</p>
            </>
          ) : (
            <p className="text-gray-500 mt-4">No weakest adaptive item available yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.symbol}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">{item.symbol}</h4>
              <span
                className={
                  item.confidenceState === "AGGRESSIVE"
                    ? "text-green-400 font-bold"
                    : item.confidenceState === "NORMAL"
                      ? "text-cyan-400 font-bold"
                      : item.confidenceState === "CAUTIOUS"
                        ? "text-yellow-400 font-bold"
                        : "text-gray-400 font-bold"
                }
              >
                {item.confidenceState}
              </span>
            </div>

            <p
              className={
                item.direction === "LONG"
                  ? "text-green-400 text-3xl font-bold mt-4"
                  : item.direction === "SHORT"
                    ? "text-red-400 text-3xl font-bold mt-4"
                    : "text-yellow-400 text-3xl font-bold mt-4"
              }
            >
              {item.direction}
            </p>

            <p className="text-cyan-400 text-4xl font-black mt-4">
              {item.adaptiveConfidence}%
            </p>

            <p className="text-gray-400 mt-3">
              Base: {item.baseConfidence}% · Adj: {item.confidenceAdjustment}
            </p>

            <p className="text-gray-400 mt-2">
              Impact: {item.learningImpact}
            </p>

            <p className="text-gray-500 mt-3 text-sm">
              {item.strategy}
            </p>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-5">
            <p className="text-gray-500">
              No adaptive confidence items available yet.
            </p>
          </div>
        )}
      </div>

      <div className="bg-gray-950 border border-cyan-900 rounded-2xl p-5">
        <h4 className="text-xl font-bold">Adaptive Confidence Recommendation</h4>
        <p className="text-cyan-300 font-bold mt-4 leading-relaxed">
          {adaptiveConfidence?.recommendation ??
            "No adaptive confidence recommendation available yet."}
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          Updated: {adaptiveConfidence?.updatedAt ?? "N/A"}
        </p>
      </div>
    </div>
  );
}