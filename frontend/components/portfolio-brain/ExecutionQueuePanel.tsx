"use client";

import React from "react";

type ExecutionQueueItem = {
  id: string;
  rank: number;
  symbol: string;
  strategy: string;
  direction: string;
  adaptiveConfidence: number;
  strategyWeight: number;
  riskState: string;
  riskPerTradePercent: number;
  maxRiskAmount: number;
  priorityScore: number;
  status: "QUEUED" | "BLOCKED";
  brokerTarget: "PAPER" | "CAPITAL_COM" | "IC_MARKETS";
  executionMode: "SIMULATION" | "DEMO" | "LIVE_BLOCKED";
  reason: string;
};

type ExecutionQueueReport = {
  version: string;
  status: "READY";
  totalApprovedTrades: number;
  queuedTrades: number;
  blockedTrades: number;
  bestQueueItem: ExecutionQueueItem | null;
  queue: ExecutionQueueItem[];
  brokerMode: "PAPER";
  liveTradingEnabled: boolean;
  recommendation: string;
  updatedAt: string;
};

type Props = {
  executionQueue: ExecutionQueueReport | null;
};

export default function ExecutionQueuePanel({
  executionQueue,
}: Props) {
  if (!executionQueue) {
    return (
      <div className="bg-black border border-cyan-900 rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">
          🚀 Execution Queue Engine V11.6.5
        </h2>
        <p className="text-gray-400">
          Waiting for execution queue data...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-black border border-cyan-900 rounded-2xl p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">
        🚀 Execution Queue Engine V11.6.5
      </h2>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-950 p-4 rounded-xl border border-green-900">
          <p className="text-gray-400">Approved</p>
          <p className="text-3xl font-bold text-green-400">
            {executionQueue.totalApprovedTrades}
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-cyan-900">
          <p className="text-gray-400">Queued</p>
          <p className="text-3xl font-bold text-cyan-400">
            {executionQueue.queuedTrades}
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-red-900">
          <p className="text-gray-400">Blocked</p>
          <p className="text-3xl font-bold text-red-400">
            {executionQueue.blockedTrades}
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-yellow-900">
          <p className="text-gray-400">Broker Mode</p>
          <p className="text-2xl font-bold text-yellow-400">
            {executionQueue.brokerMode}
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-purple-900">
          <p className="text-gray-400">Live Trading</p>
          <p className="text-2xl font-bold text-purple-400">
            {executionQueue.liveTradingEnabled ? "ON" : "OFF"}
          </p>
        </div>
      </div>

      <div className="bg-gray-950 border border-green-900 rounded-xl p-4 mb-6">
        <h3 className="font-bold text-xl mb-2">
          🏆 Best Queue Candidate
        </h3>

        <p>
          Symbol:{" "}
          <span className="text-green-400 font-bold">
            {executionQueue.bestQueueItem?.symbol ?? "N/A"}
          </span>
        </p>

        <p>
          Priority Score:{" "}
          <span className="text-cyan-400 font-bold">
            {executionQueue.bestQueueItem?.priorityScore ?? 0}
          </span>
        </p>

        <p>
          Strategy:{" "}
          <span className="text-yellow-400">
            {executionQueue.bestQueueItem?.strategy ?? "N/A"}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-3">Rank</th>
              <th className="text-left p-3">Symbol</th>
              <th className="text-left p-3">Direction</th>
              <th className="text-left p-3">Confidence</th>
              <th className="text-left p-3">Weight</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Risk</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {executionQueue.queue.map((item) => (
              <tr
                key={item.id}
                className="border-b border-gray-800"
              >
                <td className="p-3">{item.rank}</td>
                <td className="p-3 font-bold">{item.symbol}</td>
                <td className="p-3">{item.direction}</td>
                <td className="p-3">{item.adaptiveConfidence}%</td>
                <td className="p-3">{item.strategyWeight}</td>
                <td className="p-3 text-cyan-400 font-bold">
                  {item.priorityScore}
                </td>
                <td className="p-3">
                  {item.riskPerTradePercent}%
                </td>
                <td className="p-3 text-green-400 font-bold">
                  {item.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-gray-950 border border-cyan-900 rounded-xl p-4">
        <h3 className="font-bold mb-2">
          📋 Execution Recommendation
        </h3>

        <p className="text-cyan-300">
          {executionQueue.recommendation}
        </p>
      </div>
    </div>
  );
}
