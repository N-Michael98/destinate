"use client";

import React from "react";

type PortfolioBrainMemoryEntry = {
  id: string;
  createdAt: string;
  version: string;
  status: string;
  mode: string;
  decision: string;
  confidence: number;
  riskScore: number;
};

type PortfolioBrainMemoryPanelProps = {
  portfolioBrainMemory: PortfolioBrainMemoryEntry[];
  portfolioBrainMemoryCount: number;
};

export default function PortfolioBrainMemoryPanel({
  portfolioBrainMemory,
  portfolioBrainMemoryCount,
}: PortfolioBrainMemoryPanelProps) {
  return (
    <div className="bg-black border border-emerald-900 rounded-2xl p-6 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">
            Portfolio Brain Memory Panel V11.3.4
          </h3>
          <p className="text-gray-400 mt-2">
            Sichtbare Historie der gespeicherten Portfolio-Brain-Entscheidungen
            aus <span className="text-emerald-400">/api/portfolio-brain</span>.
          </p>
        </div>

        <div className="bg-gray-950 border border-emerald-800 rounded-xl p-4 min-w-[240px]">
          <p className="text-gray-400">Memory Count</p>
          <p className="text-emerald-400 text-3xl font-bold">
            {portfolioBrainMemoryCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {portfolioBrainMemory.slice(0, 4).map((entry: PortfolioBrainMemoryEntry, index: number) => (
          <div
            key={entry.id}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-xl font-bold">Memory #{index + 1}</h4>
              <span
                className={
                  entry.decision === "LONG"
                    ? "text-green-400 font-bold"
                    : entry.decision === "SHORT"
                      ? "text-red-400 font-bold"
                      : entry.decision === "BLOCK"
                        ? "text-red-400 font-bold"
                        : "text-yellow-400 font-bold"
                }
              >
                {entry.decision}
              </span>
            </div>

            <p className="text-emerald-400 font-bold text-3xl mt-4">
              {entry.confidence}%
            </p>

            <p className="text-gray-400 mt-2">Risk Score: {entry.riskScore}</p>

            <p className="text-gray-500 mt-2">
              Mode: {entry.mode} - Status: {entry.status}
            </p>

            <p className="text-gray-500 mt-4 text-sm">
              {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
        ))}

        {portfolioBrainMemory.length === 0 && (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-4">
            <p className="text-gray-500">
              No Portfolio Brain memory entries available yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
