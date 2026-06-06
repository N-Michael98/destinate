"use client";

import React from "react";

type DecisionMemoryEntry = {
  id: string;
  createdAt: string;
  version: string;
  symbol: string;
  strategy: string;
  direction: string;
  confidence: number;
  executionBias: string;
  approved: boolean;
  reason: string;
};

type DecisionMemoryReport = {
  version: string;
  status: "READY";
  totalDecisionMemories: number;
  approvedMemories: number;
  rejectedMemories: number;
  latestMemory: DecisionMemoryEntry | null;
  memory: DecisionMemoryEntry[];
  recommendation: string;
  updatedAt: string;
};

type Props = {
  decisionMemory: DecisionMemoryReport | null;
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

export default function DecisionMemoryPanel({ decisionMemory }: Props) {
  const latest = decisionMemory?.latestMemory ?? null;
  const memory = decisionMemory?.memory ?? [];

  return (
    <div className="bg-black border border-pink-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">🧠 Decision Memory Panel V11.5.4</h3>
          <p className="text-gray-400 mt-2">
            Portfolio Brain Decision Memory aus{" "}
            <span className="text-pink-400">/api/portfolio-brain-decision-memory</span>.
          </p>
        </div>

        <div className="bg-gray-950 border border-pink-800 rounded-xl p-4 min-w-[240px]">
          <p className="text-gray-400">Memory Version</p>
          <p className="text-pink-400 text-3xl font-bold">
            {decisionMemory?.version ?? "WAITING"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Total Memories"
          value={`${decisionMemory?.totalDecisionMemories ?? 0}`}
          subtitle="Stored strategy decisions"
          accent="text-pink-400"
          border="border-pink-900"
        />
        <StatCard
          title="Approved"
          value={`${decisionMemory?.approvedMemories ?? 0}`}
          subtitle="Approved decisions"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Rejected"
          value={`${decisionMemory?.rejectedMemories ?? 0}`}
          subtitle="Rejected decisions"
          accent="text-red-400"
          border="border-red-900"
        />
        <StatCard
          title="Latest Symbol"
          value={latest?.symbol ?? "N/A"}
          subtitle="Most recent memory"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Latest Direction"
          value={latest?.direction ?? "N/A"}
          subtitle="LONG / SHORT / WAIT"
          accent={
            latest?.direction === "LONG"
              ? "text-green-400"
              : latest?.direction === "SHORT"
                ? "text-red-400"
                : "text-yellow-400"
          }
          border={
            latest?.direction === "LONG"
              ? "border-green-900"
              : latest?.direction === "SHORT"
                ? "border-red-900"
                : "border-yellow-900"
          }
        />
      </div>

      <div className="bg-gray-950 border border-pink-900 rounded-2xl p-5 mb-6">
        <h4 className="text-xl font-bold">Latest Decision Memory</h4>

        {latest ? (
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-black border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400">Symbol</p>
              <p className="text-cyan-400 text-2xl font-bold">{latest.symbol}</p>
            </div>

            <div className="bg-black border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400">Strategy</p>
              <p className="text-pink-300 font-bold">{latest.strategy}</p>
            </div>

            <div className="bg-black border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400">Confidence</p>
              <p className="text-green-400 text-2xl font-bold">{latest.confidence}%</p>
            </div>

            <div className="bg-black border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400">Status</p>
              <p className={latest.approved ? "text-green-400 text-2xl font-bold" : "text-red-400 text-2xl font-bold"}>
                {latest.approved ? "APPROVED" : "REJECTED"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 mt-4">No latest decision memory available yet.</p>
        )}

        <p className="text-gray-400 mt-5 leading-relaxed">
          {latest?.reason ?? "No reason available yet."}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        {memory.slice(0, 5).map((entry) => (
          <div
            key={entry.id}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">{entry.symbol}</h4>
              <span
                className={
                  entry.approved
                    ? "text-green-400 font-bold"
                    : "text-red-400 font-bold"
                }
              >
                {entry.approved ? "APPROVED" : "REJECTED"}
              </span>
            </div>

            <p
              className={
                entry.direction === "LONG"
                  ? "text-green-400 font-bold text-3xl mt-4"
                  : entry.direction === "SHORT"
                    ? "text-red-400 font-bold text-3xl mt-4"
                    : "text-yellow-400 font-bold text-3xl mt-4"
              }
            >
              {entry.direction}
            </p>

            <p className="text-pink-300 font-bold mt-3">{entry.strategy}</p>
            <p className="text-gray-400 mt-3">Confidence: {entry.confidence}%</p>
            <p className="text-gray-400 mt-2">Bias: {entry.executionBias}</p>
            <p className="text-gray-500 mt-4 text-sm">
              {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
        ))}

        {memory.length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-5">
            <p className="text-gray-500">No Portfolio Brain decision memory available yet.</p>
          </div>
        )}
      </div>

      <div className="bg-gray-950 border border-pink-900 rounded-2xl p-5">
        <h4 className="text-xl font-bold">Decision Memory Recommendation</h4>
        <p className="text-pink-300 font-bold mt-4 leading-relaxed">
          {decisionMemory?.recommendation ?? "No decision memory recommendation available yet."}
        </p>
        <p className="text-gray-500 mt-4 text-sm">
          Updated: {decisionMemory?.updatedAt ?? "N/A"}
        </p>
      </div>
    </div>
  );
}