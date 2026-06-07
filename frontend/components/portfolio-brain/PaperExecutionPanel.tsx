"use client";

import React from "react";

type PaperExecutionStatus =
  | "SIMULATED_OPEN"
  | "SIMULATED_CLOSED"
  | "SKIPPED";

type PaperTradeExecution = {
  id: string;
  queueId: string;
  symbol: string;
  strategy: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPerTradePercent: number;
  maxRiskAmount: number;
  simulatedPositionSize: number;
  simulatedOutcome: "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
  simulatedPnlAmount: number;
  simulatedPnlPercent: number;
  status: PaperExecutionStatus;
  reason: string;
  createdAt: string;
};

type PaperExecutionReport = {
  version: string;
  status: "READY";
  mode: "PAPER_SIMULATION";
  totalQueueItems: number;
  executedTrades: number;
  skippedTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  openTrades: number;
  totalSimulatedPnlAmount: number;
  averageSimulatedPnlPercent: number;
  bestTrade: PaperTradeExecution | null;
  worstTrade: PaperTradeExecution | null;
  executions: PaperTradeExecution[];
  recommendation: string;
  updatedAt: string;
};

type Props = {
  paperExecution: PaperExecutionReport | null;
};

export default function PaperExecutionPanel({ paperExecution }: Props) {
  if (!paperExecution) {
    return (
      <div className="bg-black border border-green-900 rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">
          📄 Paper Execution Engine V11.6.7
        </h2>
        <p className="text-gray-400">
          Waiting for paper execution data...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-black border border-green-900 rounded-2xl p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">
        📄 Paper Execution Engine V11.6.7
      </h2>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-950 p-4 rounded-xl border border-cyan-900">
          <p className="text-gray-400">Executed</p>
          <p className="text-3xl font-bold text-cyan-400">
            {paperExecution.executedTrades}
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-green-900">
          <p className="text-gray-400">Wins</p>
          <p className="text-3xl font-bold text-green-400">
            {paperExecution.wins}
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-red-900">
          <p className="text-gray-400">Losses</p>
          <p className="text-3xl font-bold text-red-400">
            {paperExecution.losses}
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-yellow-900">
          <p className="text-gray-400">Avg PnL %</p>
          <p className="text-3xl font-bold text-yellow-400">
            {paperExecution.averageSimulatedPnlPercent}%
          </p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-green-900">
          <p className="text-gray-400">Total PnL</p>
          <p className="text-3xl font-bold text-green-400">
            {paperExecution.totalSimulatedPnlAmount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-950 border border-green-900 rounded-xl p-4">
          <h3 className="font-bold text-xl mb-2">
            🏆 Best Paper Trade
          </h3>
          <p>
            Symbol:{" "}
            <span className="text-green-400 font-bold">
              {paperExecution.bestTrade?.symbol ?? "N/A"}
            </span>
          </p>
          <p>
            Outcome:{" "}
            <span className="text-green-400 font-bold">
              {paperExecution.bestTrade?.simulatedOutcome ?? "N/A"}
            </span>
          </p>
          <p>
            PnL:{" "}
            <span className="text-cyan-400 font-bold">
              {paperExecution.bestTrade?.simulatedPnlAmount ?? 0}
            </span>
          </p>
        </div>

        <div className="bg-gray-950 border border-red-900 rounded-xl p-4">
          <h3 className="font-bold text-xl mb-2">
            ⚠️ Worst Paper Trade
          </h3>
          <p>
            Symbol:{" "}
            <span className="text-red-400 font-bold">
              {paperExecution.worstTrade?.symbol ?? "N/A"}
            </span>
          </p>
          <p>
            Outcome:{" "}
            <span className="text-red-400 font-bold">
              {paperExecution.worstTrade?.simulatedOutcome ?? "N/A"}
            </span>
          </p>
          <p>
            PnL:{" "}
            <span className="text-cyan-400 font-bold">
              {paperExecution.worstTrade?.simulatedPnlAmount ?? 0}
            </span>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-3">Symbol</th>
              <th className="text-left p-3">Direction</th>
              <th className="text-left p-3">Entry</th>
              <th className="text-left p-3">SL</th>
              <th className="text-left p-3">TP</th>
              <th className="text-left p-3">Risk</th>
              <th className="text-left p-3">Size</th>
              <th className="text-left p-3">Outcome</th>
              <th className="text-left p-3">PnL</th>
            </tr>
          </thead>

          <tbody>
            {paperExecution.executions.map((trade) => (
              <tr
                key={trade.id}
                className="border-b border-gray-800"
              >
                <td className="p-3 font-bold">{trade.symbol}</td>
                <td className="p-3">{trade.direction}</td>
                <td className="p-3">{trade.entryPrice}</td>
                <td className="p-3">{trade.stopLoss}</td>
                <td className="p-3">{trade.takeProfit}</td>
                <td className="p-3">{trade.riskPerTradePercent}%</td>
                <td className="p-3">{trade.simulatedPositionSize}</td>
                <td
                  className={
                    trade.simulatedOutcome === "WIN"
                      ? "p-3 text-green-400 font-bold"
                      : trade.simulatedOutcome === "LOSS"
                        ? "p-3 text-red-400 font-bold"
                        : "p-3 text-yellow-400 font-bold"
                  }
                >
                  {trade.simulatedOutcome}
                </td>
                <td
                  className={
                    trade.simulatedPnlAmount >= 0
                      ? "p-3 text-green-400 font-bold"
                      : "p-3 text-red-400 font-bold"
                  }
                >
                  {trade.simulatedPnlAmount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-gray-950 border border-green-900 rounded-xl p-4">
        <h3 className="font-bold mb-2">
          📋 Paper Execution Recommendation
        </h3>

        <p className="text-green-300">
          {paperExecution.recommendation}
        </p>
      </div>
    </div>
  );
}
