"use client";

import { useEffect, useState } from "react";

interface StrategyRankingProfile {
  strategyId: string;
  strategyName: string;
  symbol: string;
  tradingStyle: string;
  finalStrategyScore: number;
  rank: number;
  recommendation: string;
}

interface MarketStrategyRanking {
  market: string;
  symbol: string;
  topStrategyName: string;
  topStrategyScore: number;
  averageStrategyScore: number;
}

interface StrategyRankingReport {
  version: string;
  status: string;
  totalStrategiesRanked: number;
  topStrategyOverall: string;
  weakestStrategyOverall: string;
  rankingProfiles: StrategyRankingProfile[];
  marketRankings: MarketStrategyRanking[];
  rankingNotes: string[];
  mode: string[];
  createdAt: string;
}

export default function StrategyRankingDashboardPanel() {
  const [report, setReport] = useState<StrategyRankingReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await fetch("/api/strategy-ranking");
      const data = await response.json();
      setReport(data.report);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 p-6">
        Loading Strategy Ranking Engine...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-red-800 p-6">
        Strategy Ranking Engine unavailable
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cyan-400">
          V13.0.1 Strategy Ranking Dashboard
        </h2>

        <p className="text-sm text-slate-400">
          Strategy Universe Ranking Intelligence
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-slate-800 p-4">
          <div className="text-slate-400 text-sm">Status</div>
          <div className="text-green-400 font-bold">
            {report.status}
          </div>
        </div>

        <div className="rounded-lg bg-slate-800 p-4">
          <div className="text-slate-400 text-sm">
            Strategies Ranked
          </div>
          <div className="text-white text-xl font-bold">
            {report.totalStrategiesRanked}
          </div>
        </div>

        <div className="rounded-lg bg-slate-800 p-4">
          <div className="text-slate-400 text-sm">
            Top Strategy
          </div>
          <div className="text-cyan-400 font-bold">
            {report.topStrategyOverall}
          </div>
        </div>

        <div className="rounded-lg bg-slate-800 p-4">
          <div className="text-slate-400 text-sm">
            Weakest Strategy
          </div>
          <div className="text-red-400 font-bold">
            {report.weakestStrategyOverall}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-3">
          Top Ranked Strategies
        </h3>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left p-2">Rank</th>
                <th className="text-left p-2">Strategy</th>
                <th className="text-left p-2">Symbol</th>
                <th className="text-left p-2">Style</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Recommendation</th>
              </tr>
            </thead>

            <tbody>
              {report.rankingProfiles
                .slice(0, 15)
                .map((strategy) => (
                  <tr
                    key={`${strategy.strategyId}-${strategy.rank}`}
                    className="border-b border-slate-800"
                  >
                    <td className="p-2">{strategy.rank}</td>
                    <td className="p-2 text-cyan-300">
                      {strategy.strategyName}
                    </td>
                    <td className="p-2">{strategy.symbol}</td>
                    <td className="p-2">
                      {strategy.tradingStyle}
                    </td>
                    <td className="p-2 font-bold">
                      {strategy.finalStrategyScore}
                    </td>
                    <td className="p-2">
                      {strategy.recommendation}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-3">
          Market Rankings
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          {report.marketRankings.slice(0, 10).map((market) => (
            <div
              key={`${market.market}-${market.symbol}`}
              className="rounded-lg bg-slate-800 p-4"
            >
              <div className="font-bold text-cyan-300">
                {market.market} / {market.symbol}
              </div>

              <div className="text-sm text-slate-400 mt-2">
                Top Strategy:
              </div>

              <div className="text-white">
                {market.topStrategyName}
              </div>

              <div className="mt-2 text-green-400">
                Score: {market.topStrategyScore}
              </div>

              <div className="text-slate-400 text-sm">
                Average Score: {market.averageStrategyScore}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-3">
          Ranking Notes
        </h3>

        <div className="space-y-2">
          {report.rankingNotes.map((note, index) => (
            <div
              key={index}
              className="rounded bg-slate-800 p-3 text-sm"
            >
              {note}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-slate-800 p-4">
        <div className="text-slate-400 text-sm">
          Safety Mode
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {report.mode.map((mode) => (
            <span
              key={mode}
              className="px-3 py-1 rounded bg-cyan-900 text-cyan-300 text-xs"
            >
              {mode}
            </span>
          ))}
        </div>

        <div className="text-xs text-slate-500 mt-3">
          Generated: {new Date(report.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
