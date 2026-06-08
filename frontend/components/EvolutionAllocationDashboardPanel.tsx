"use client";

import { useEffect, useState } from "react";

interface AllocationEntry {
  species: string;
  governanceStatus: string;
  governanceScore: number;
  currentAllocation: number;
  targetAllocation: number;
  allocationAdjustment: number;
  reason: string;
}

interface EvolutionAllocationReport {
  version: string;
  status: string;
  championSpecies: string;
  totalAllocation: number;
  summary: string;
  createdAt: string;
  entries: AllocationEntry[];
}

export default function EvolutionAllocationDashboardPanel() {
  const [report, setReport] =
    useState<EvolutionAllocationReport | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await fetch("/api/evolution-allocation");
      const data = await response.json();

      setReport(data.report);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-900 p-6 rounded-xl border border-cyan-500">
        Loading Evolution Allocation...
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-cyan-500">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4">
        Evolution Allocation Engine V14.2.1
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-black p-4 rounded-lg">
          <p className="text-gray-400">Champion</p>
          <p className="text-green-400 font-bold">
            {report.championSpecies}
          </p>
        </div>

        <div className="bg-black p-4 rounded-lg">
          <p className="text-gray-400">Total Allocation</p>
          <p className="text-cyan-400 font-bold">
            {report.totalAllocation}%
          </p>
        </div>

        <div className="bg-black p-4 rounded-lg">
          <p className="text-gray-400">Version</p>
          <p className="text-white">{report.version}</p>
        </div>

        <div className="bg-black p-4 rounded-lg">
          <p className="text-gray-400">Status</p>
          <p className="text-green-400">{report.status}</p>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cyan-400 border-b border-cyan-700">
              <th className="text-left p-2">Species</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Score</th>
              <th className="text-left p-2">Current</th>
              <th className="text-left p-2">Target</th>
              <th className="text-left p-2">Adjustment</th>
            </tr>
          </thead>

          <tbody>
            {report.entries.map((entry) => (
              <tr
                key={entry.species}
                className="border-b border-gray-800"
              >
                <td className="p-2 font-bold text-white">
                  {entry.species}
                </td>

                <td className="p-2">
                  {entry.governanceStatus}
                </td>

                <td className="p-2">
                  {entry.governanceScore}
                </td>

                <td className="p-2">
                  {entry.currentAllocation}%
                </td>

                <td className="p-2 text-cyan-400 font-bold">
                  {entry.targetAllocation}%
                </td>

                <td
                  className={`p-2 font-bold ${
                    entry.allocationAdjustment >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {entry.allocationAdjustment > 0 ? "+" : ""}
                  {entry.allocationAdjustment}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-black p-4 rounded-lg">
        <p className="text-gray-300">{report.summary}</p>
      </div>
    </div>
  );
}