"use client";

import { useEffect, useState } from "react";

type Strategy = {
  id: string;
  name: string;
  category: string;
  description: string;
  markets: string[];
  timeframes: string[];
  riskLevel: string;
  complexity: string;
  status: string;
  baseScore: number;
  confidenceBoost: number;
  rules: string[];
};

type StrategyLibraryResponse = {
  ok: boolean;
  version: string;
  totalStrategies: number;
  activeAndWatch: number;
  strategies: Strategy[];
};

export default function StrategyLibraryPanel() {
  const [data, setData] =
    useState<StrategyLibraryResponse | null>(null);

  const [loading, setLoading] =
    useState(false);

  async function loadLibrary() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/ai-paper-trader/strategy-library",
        {
          cache: "no-store",
        }
      );

      const json =
        (await response.json()) as StrategyLibraryResponse;

      setData(json);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  const strategies =
    data?.strategies ?? [];

  return (
    <section className="bg-black border border-blue-900 rounded-2xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-4xl font-black">
            📚 Strategy Library Universe V10.4.5
          </h2>

          <p className="text-gray-400 mt-2">
            Vollständige Strategy Universe Übersicht.
          </p>
        </div>

        <button
          onClick={loadLibrary}
          disabled={loading}
          className="px-5 py-3 rounded-xl border border-blue-800 bg-blue-950 text-blue-300 font-bold"
        >
          {loading
            ? "Refreshing..."
            : "Refresh Library"}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        <div className="bg-gray-950 p-5 rounded-xl border border-gray-800">
          <p className="text-gray-400">
            Total Strategies
          </p>
          <p className="text-4xl font-black text-blue-400">
            {data?.totalStrategies ?? 0}
          </p>
        </div>

        <div className="bg-gray-950 p-5 rounded-xl border border-gray-800">
          <p className="text-gray-400">
            Active / Watch
          </p>
          <p className="text-4xl font-black text-green-400">
            {data?.activeAndWatch ?? 0}
          </p>
        </div>

        <div className="bg-gray-950 p-5 rounded-xl border border-gray-800">
          <p className="text-gray-400">
            Categories
          </p>
          <p className="text-4xl font-black text-purple-400">
            {
              new Set(
                strategies.map(
                  (s) => s.category
                )
              ).size
            }
          </p>
        </div>

        <div className="bg-gray-950 p-5 rounded-xl border border-gray-800">
          <p className="text-gray-400">
            Version
          </p>
          <p className="text-2xl font-black text-yellow-400">
            {data?.version ?? "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-6"
          >
            <div className="flex justify-between">
              <h3 className="text-2xl font-bold">
                {strategy.name}
              </h3>

              <span className="text-blue-400 font-bold">
                {strategy.category}
              </span>
            </div>

            <p className="text-gray-400 mt-3">
              {strategy.description}
            </p>

            <div className="grid grid-cols-3 gap-3 mt-5">
              <div>
                <p className="text-gray-500">
                  Risk
                </p>
                <p>{strategy.riskLevel}</p>
              </div>

              <div>
                <p className="text-gray-500">
                  Complexity
                </p>
                <p>{strategy.complexity}</p>
              </div>

              <div>
                <p className="text-gray-500">
                  Status
                </p>
                <p>{strategy.status}</p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-gray-500 mb-2">
                Rules
              </p>

              <ul className="list-disc ml-5 text-sm text-gray-300">
                {strategy.rules
                  .slice(0, 4)
                  .map((rule) => (
                    <li key={rule}>
                      {rule}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}