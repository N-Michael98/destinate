"use client";

import React, { useEffect, useState } from "react";

type AIAgentRunResult = {
  ok: boolean;
  result?: {
    ok: boolean;
    executed: boolean;
    idea?: {
      source: string;
      symbol: string;
      direction: string;
      entry: number;
      stopLoss: number;
      takeProfit1: number;
      takeProfit2: number;
      confidence: number;
      reason: string;
    };
    risk?: {
      source: string;
      approved: boolean;
      riskScore: number;
      maxRiskPercent: number;
      reason: string;
    };
    consensus?: {
      source: string;
      approved: boolean;
      score: number;
      reason: string;
    };
    message: string;
  };
  timestamp?: string;
};

type PaperHistoryEvent = {
  id: string;
  type: string;
  entity: string;
  event: string;
  timestamp: string;
  payload: unknown;
};

type PaperPerformance = {
  totalEvents: number;
  totalTrades: number;
  orderCreated: number;
  orderFilled: number;
  openPositions: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  realizedPnL: number;
  unrealizedPnL: number;
  profitFactor: number;
  averageRR: number;
  status: string;
  updatedAt: string;
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

export default function AIAgentControlCenter() {
  const [lastRun, setLastRun] = useState<AIAgentRunResult | null>(null);
  const [history, setHistory] = useState<PaperHistoryEvent[]>([]);
  const [performance, setPerformance] = useState<PaperPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshData() {
    try {
      setLoading(true);

      const [historyResponse, performanceResponse] = await Promise.all([
        fetch("/api/paper/history", { cache: "no-store" }),
        fetch("/api/paper/performance", { cache: "no-store" }),
      ]);

      const historyPayload = await historyResponse.json();
      const performancePayload = await performanceResponse.json();

      setHistory(historyPayload.history ?? []);
      setPerformance(performancePayload.performance ?? null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to refresh AI Agent data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAIAgentTrade() {
    try {
      setRunning(true);
      setMessage(null);

      const response = await fetch("/api/ai-paper-trader/run", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`AI Agent request failed: ${response.status}`);
      }

      const payload = (await response.json()) as AIAgentRunResult;

      setLastRun(payload);
      setMessage(
        payload.result?.executed
          ? "AI Agent created a new paper trade."
          : "AI Agent completed review without execution."
      );

      await refreshData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to run AI Agent."
      );
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  const aiEvents = history
    .filter((event) =>
      String(event.type).includes("ORDER") ||
      String(event.type).includes("POSITION")
    )
    .slice(-6)
    .reverse();

  const idea = lastRun?.result?.idea;
  const risk = lastRun?.result?.risk;
  const consensus = lastRun?.result?.consensus;
  const executed = lastRun?.result?.executed ?? false;

  return (
    <section className="bg-gray-900 border border-fuchsia-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-5xl font-black">🤖 AI Agent Control Center V10.3.1</h2>
          <p className="text-gray-400 text-xl mt-4 leading-relaxed">
            Kontrollzentrum für GPT Analyst, Claude Risk, Consensus Engine und automatische Paper-Trading-Ausführung.
          </p>
        </div>

        <div className="bg-black border border-fuchsia-800 rounded-2xl p-5 min-w-[220px]">
          <p className="text-gray-400">Agent Status</p>
          <p className="text-fuchsia-400 text-3xl font-bold">Online</p>
        </div>
      </div>

      {message && (
        <div className="bg-fuchsia-950 border border-fuchsia-800 rounded-2xl p-5 mb-8">
          <p className="text-fuchsia-200 font-bold">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard
          title="GPT Analyst"
          value={idea ? idea.direction : "Ready"}
          subtitle={idea ? `${idea.symbol} · ${idea.confidence}%` : "Mock signal engine"}
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Claude Risk"
          value={risk ? (risk.approved ? "Approved" : "Rejected") : "Ready"}
          subtitle={risk ? `Risk score ${risk.riskScore}` : "Risk validation"}
          accent={risk?.approved ? "text-green-400" : "text-red-400"}
          border={risk?.approved ? "border-green-900" : "border-red-900"}
        />
        <StatCard
          title="Consensus"
          value={consensus ? (consensus.approved ? "Approved" : "Blocked") : "Ready"}
          subtitle={consensus ? `Score ${consensus.score}` : "Decision gate"}
          accent={consensus?.approved ? "text-green-400" : "text-yellow-400"}
          border={consensus?.approved ? "border-green-900" : "border-yellow-900"}
        />
        <StatCard
          title="Execution"
          value={executed ? "Executed" : "Waiting"}
          subtitle="Paper only"
          accent={executed ? "text-green-400" : "text-purple-400"}
          border={executed ? "border-green-900" : "border-purple-900"}
        />
        <StatCard
          title="Total Trades"
          value={`${performance?.totalTrades ?? 0}`}
          subtitle="Paper performance"
          accent="text-blue-400"
          border="border-blue-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-3xl font-bold mb-5">🚀 Run AI Agent</h3>
          <p className="text-gray-400 leading-relaxed mb-6">
            Startet einen vollständigen Mock-Agent-Zyklus: GPT Trade Idea → Claude Risk → Consensus → Paper Order.
          </p>

          <button
            type="button"
            onClick={runAIAgentTrade}
            disabled={running}
            className="w-full bg-fuchsia-950 border border-fuchsia-800 rounded-xl px-6 py-4 font-bold text-fuchsia-200 hover:bg-fuchsia-900 transition disabled:opacity-60"
          >
            {running ? "Running AI Agent..." : "Run AI Paper Trade"}
          </button>

          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="w-full mt-4 bg-gray-950 border border-gray-700 rounded-xl px-6 py-4 font-bold text-gray-200 hover:bg-gray-900 transition disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-3xl font-bold mb-5">🧠 Last AI Decision</h3>

          {lastRun?.result ? (
            <div className="space-y-4">
              <StatusPill
                label="Symbol"
                value={idea?.symbol ?? "N/A"}
                accent="text-cyan-400"
              />
              <StatusPill
                label="Direction"
                value={idea?.direction ?? "N/A"}
                accent={idea?.direction === "LONG" ? "text-green-400" : "text-red-400"}
              />
              <StatusPill
                label="Confidence"
                value={`${idea?.confidence ?? 0}%`}
                accent="text-purple-400"
              />
              <StatusPill
                label="Decision"
                value={executed ? "Executed" : "Rejected"}
                accent={executed ? "text-green-400" : "text-red-400"}
              />
            </div>
          ) : (
            <p className="text-gray-500">No AI run yet in this browser session.</p>
          )}
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-3xl font-bold mb-5">📊 Agent Performance</h3>
          <div className="space-y-4">
            <StatusPill
              label="History Events"
              value={`${performance?.totalEvents ?? history.length}`}
              accent="text-purple-400"
            />
            <StatusPill
              label="Open Positions"
              value={`${performance?.openPositions ?? 0}`}
              accent="text-yellow-400"
            />
            <StatusPill
              label="Win Rate"
              value={`${performance?.winRate ?? 0}%`}
              accent="text-green-400"
            />
            <StatusPill
              label="Unrealized P/L"
              value={`${performance?.unrealizedPnL ?? 0}`}
              accent="text-cyan-400"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-3xl font-bold mb-5">🧩 GPT Analyst Output</h3>
          {idea ? (
            <div className="bg-gray-950 border border-cyan-900 rounded-xl p-5">
              <p className="text-cyan-400 font-bold text-xl">
                {idea.symbol} {idea.direction}
              </p>
              <p className="text-gray-400 mt-3">Entry: {idea.entry}</p>
              <p className="text-gray-400">SL: {idea.stopLoss}</p>
              <p className="text-gray-400">TP1: {idea.takeProfit1}</p>
              <p className="text-gray-400">TP2: {idea.takeProfit2}</p>
              <p className="text-gray-500 mt-4 leading-relaxed">{idea.reason}</p>
            </div>
          ) : (
            <p className="text-gray-500">Run the AI Agent to generate a trade idea.</p>
          )}
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-3xl font-bold mb-5">🛡 Claude Risk Output</h3>
          {risk ? (
            <div className="bg-gray-950 border border-red-900 rounded-xl p-5">
              <p className={risk.approved ? "text-green-400 font-bold text-xl" : "text-red-400 font-bold text-xl"}>
                {risk.approved ? "APPROVED" : "REJECTED"}
              </p>
              <p className="text-gray-400 mt-3">Risk Score: {risk.riskScore}</p>
              <p className="text-gray-400">Max Risk: {risk.maxRiskPercent}%</p>
              <p className="text-gray-500 mt-4 leading-relaxed">{risk.reason}</p>
            </div>
          ) : (
            <p className="text-gray-500">Risk output appears after the first AI run.</p>
          )}
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-3xl font-bold mb-5">⚡ Decision Feed</h3>
          <div className="space-y-4">
            {aiEvents.map((event) => (
              <div
                key={event.id}
                className="bg-gray-950 border border-gray-800 rounded-xl p-4"
              >
                <p className="text-fuchsia-400 font-bold">{event.type}</p>
                <p className="text-gray-500 mt-2">{event.timestamp}</p>
              </div>
            ))}

            {aiEvents.length === 0 && (
              <p className="text-gray-500">No AI paper trade events yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
