"use client";

import React from "react";

type MarketOpportunity = {
  rank: number;
  symbol: string;
  displayName: string;
  assetClass: string;
  tradingViewSymbol: string;
  regime: string;
  direction: "LONG" | "SHORT" | "WAIT";
  opportunityScore: number;
  trendScore: number;
  volatilityScore: number;
  strategyScore: number;
  riskScore: number;
  confidence: number;
  preferredStrategies: string[];
  reason: string;
};

type OpportunityScannerReport = {
  version: string;
  status: "READY";
  totalMarketsScanned: number;
  tradableOpportunities: number;
  longOpportunities: number;
  shortOpportunities: number;
  waitOpportunities: number;
  bestOpportunity: MarketOpportunity | null;
  topOpportunities: MarketOpportunity[];
  opportunities: MarketOpportunity[];
  recommendation: string;
  updatedAt: string;
};

type Props = {
  scanner: OpportunityScannerReport | null;
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

function directionColor(direction: string): string {
  if (direction === "LONG") return "text-green-400";
  if (direction === "SHORT") return "text-red-400";
  return "text-yellow-400";
}

function regimeColor(regime: string): string {
  if (regime === "BULLISH") return "text-green-400";
  if (regime === "BEARISH") return "text-red-400";
  if (regime === "VOLATILE") return "text-orange-400";
  return "text-yellow-400";
}

export default function OpportunityDashboardPanel({ scanner }: Props) {
  const best = scanner?.bestOpportunity ?? null;

  return (
    <div className="bg-black border border-cyan-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🎯 Opportunity Dashboard V11.4.8</h3>
          <p className="text-gray-400 mt-2">
            Dynamische Top Opportunities aus <span className="text-cyan-400">/api/opportunity-scanner</span>.
            Diese Märkte ersetzen später die fixen Charts wie Gold, Oil, EURUSD und BTC.
          </p>
        </div>

        <div className="bg-gray-950 border border-cyan-800 rounded-xl p-4 min-w-[260px]">
          <p className="text-gray-400">Best Opportunity</p>
          <p className={`text-3xl font-bold ${directionColor(best?.direction ?? "WAIT")}`}>
            {best ? `${best.symbol} ${best.direction}` : "WAITING"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Markets Scanned"
          value={`${scanner?.totalMarketsScanned ?? 0}`}
          subtitle="Dynamic universe scan"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Tradable"
          value={`${scanner?.tradableOpportunities ?? 0}`}
          subtitle="LONG / SHORT candidates"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Long Setups"
          value={`${scanner?.longOpportunities ?? 0}`}
          subtitle="Bullish opportunities"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Short Setups"
          value={`${scanner?.shortOpportunities ?? 0}`}
          subtitle="Bearish opportunities"
          accent="text-red-400"
          border="border-red-900"
        />
        <StatCard
          title="Wait"
          value={`${scanner?.waitOpportunities ?? 0}`}
          subtitle="No-trade candidates"
          accent="text-yellow-400"
          border="border-yellow-900"
        />
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        {(scanner?.topOpportunities ?? []).map((item) => (
          <div key={`${item.rank}-${item.symbol}`} className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">#{item.rank}</h4>
              <span className={`font-bold ${directionColor(item.direction)}`}>{item.direction}</span>
            </div>

            <p className="text-cyan-300 font-bold text-2xl mt-4">{item.symbol}</p>
            <p className="text-gray-400 mt-1">{item.displayName}</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-black border border-gray-800 rounded-xl p-3">
                <p className="text-gray-500 text-sm">Confidence</p>
                <p className="text-white font-bold">{item.confidence}%</p>
              </div>
              <div className="bg-black border border-gray-800 rounded-xl p-3">
                <p className="text-gray-500 text-sm">Risk</p>
                <p className="text-white font-bold">{item.riskScore}</p>
              </div>
            </div>

            <p className={`font-bold mt-4 ${regimeColor(item.regime)}`}>{item.regime}</p>
            <p className="text-gray-500 text-sm mt-2">
              Score {item.opportunityScore} · Strategy {item.strategyScore}
            </p>
          </div>
        ))}

        {(scanner?.topOpportunities ?? []).length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-5">
            <p className="text-gray-500">No opportunity scanner data available yet.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-gray-950 border border-cyan-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Scanner Recommendation</h4>
          <p className="text-cyan-300 font-bold mt-4 leading-relaxed">
            {scanner?.recommendation ?? "No scanner recommendation available yet."}
          </p>
          <p className="text-gray-500 mt-4 text-sm">Updated: {scanner?.updatedAt ?? "N/A"}</p>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">Next Integration</h4>
          <p className="text-gray-400 mt-4 leading-relaxed">
            Diese Top Opportunities werden als nächste Grundlage für Dynamic Market Data Charts, Strategy Evolution, Portfolio Brain und später Execution verwendet.
          </p>
        </div>
      </div>
    </div>
  );
}
