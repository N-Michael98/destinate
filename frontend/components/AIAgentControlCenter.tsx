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
      baseConfidence?: number;
      adaptiveConfidenceApplied?: boolean;
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

type AgentMemoryEntry = {
  id: string;
  type: string;
  symbol?: string;
  direction?: string;
  confidence?: number;
  approved?: boolean;
  executed?: boolean;
  consensusScore?: number;
  riskScore?: number;
  reason: string;
  payload: unknown;
  createdAt: string;
};

type AgentMemoryStats = {
  totalMemories: number;
  executedTrades: number;
  rejectedTrades: number;
  averageConfidence: number;
  averageConsensus: number;
  updatedAt: string;
};

type AgentMemoryResponse = {
  ok: boolean;
  memory: AgentMemoryEntry[];
  latest: AgentMemoryEntry[];
  stats: AgentMemoryStats;
  timestamp: string;
};

type AILearning = {
  version: string;
  totalMemories: number;
  executedTrades: number;
  rejectedTrades: number;
  executionRate: number;
  rejectionRate: number;
  averageConfidence: number;
  averageConsensus: number;
  averageRiskScore: number;
  confidenceGap: number;
  learningScore: number;
  agentAccuracy: number;
  recommendedConfidence: number;
  recommendation: string;
  status: string;
  updatedAt: string;
};

type AILearningResponse = {
  ok: boolean;
  learning: AILearning;
  timestamp: string;
};

type AIOutcomes = {
  version: string;
  totalAIMemories: number;
  executedTrades: number;
  rejectedTrades: number;
  positionUpdates: number;
  wins: number;
  losses: number;
  closedTrades: number;
  winRate: number;
  totalUnrealizedPnL: number;
  averagePnL: number;
  outcomeQuality: number;
  recommendation: string;
  latestOutcomeEvents: PaperHistoryEvent[];
  status: string;
  updatedAt: string;
};

type AIOutcomesResponse = {
  ok: boolean;
  outcomes: AIOutcomes;
  timestamp: string;
};

type StrategyProfile = {
  id: string;
  name: string;
  type: string;
  category?: string;
  status: string;
  baseScore: number;
  score: number;
  confidenceBoost: number;
  riskLevel?: string;
  complexity?: string;
  markets?: string[];
  timeframes?: string[];
  regimeFit?: string;
  reason: string;
};

type StrategyEvolution = {
  version: string;
  totalStrategies?: number;
  selectableStrategies?: number;
  marketRegime?: MarketRegimeData;
  preferredCategories?: string[];
  adaptiveFactor: number;
  bestStrategy: StrategyProfile;
  strategies: StrategyProfile[];
  regimeMatchedStrategies?: StrategyProfile[];
  recommendation: string;
  status: string;
  updatedAt: string;
};

type StrategyEvolutionResponse = {
  ok: boolean;
  strategy: StrategyEvolution;
  timestamp: string;
};

type MarketRegimeData = {
  version: string;
  regime: "TRENDING" | "RANGING" | "VOLATILE" | "NEWS";
  score: number;
  recommendation: string;
  memoryConfidence: number;
  learningScore: number;
  winRate: number;
  totalMemories: number;
  updatedAt: string;
};

type MarketRegimeResponse = {
  ok: boolean;
  regime: MarketRegimeData;
  timestamp: string;
};

type NewsItem = {
  id: string;
  title: string;
  category: string;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sentiment: string;
  affectedMarkets: string[];
  source: string;
  summary: string;
  timestamp: string;
};

type NewsIntelligenceReport = {
  version: string;
  totalNews: number;
  highImpactNews: number;
  geopoliticalRisk: string;
  macroRisk: string;
  overallSentiment: string;
  marketRiskScore: number;
  affectedMarkets: string[];
  recommendation: string;
  news: NewsItem[];
  updatedAt: string;
};

type NewsIntelligenceResponse = {
  ok: boolean;
  report: NewsIntelligenceReport;
  timestamp: string;
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
  const [memory, setMemory] = useState<AgentMemoryEntry[]>([]);
  const [latestMemory, setLatestMemory] = useState<AgentMemoryEntry[]>([]);
  const [memoryStats, setMemoryStats] = useState<AgentMemoryStats | null>(null);
  const [learning, setLearning] = useState<AILearning | null>(null);
  const [outcomes, setOutcomes] = useState<AIOutcomes | null>(null);
  const [strategy, setStrategy] = useState<StrategyEvolution | null>(null);
  const [marketRegime, setMarketRegime] = useState<MarketRegimeData | null>(null);
  const [newsIntelligence, setNewsIntelligence] = useState<NewsIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshData() {
    try {
      setLoading(true);

      const [
        historyResponse,
        performanceResponse,
        memoryResponse,
        learningResponse,
        outcomesResponse,
        strategyResponse,
        marketRegimeResponse,
        newsIntelligenceResponse,
      ] = await Promise.all([
        fetch("/api/paper/history", { cache: "no-store" }),
        fetch("/api/paper/performance", { cache: "no-store" }),
        fetch("/api/ai-paper-trader/memory", { cache: "no-store" }),
        fetch("/api/ai-paper-trader/learning", { cache: "no-store" }),
        fetch("/api/ai-paper-trader/outcomes", { cache: "no-store" }),
        fetch("/api/ai-paper-trader/strategy", { cache: "no-store" }),
        fetch("/api/ai-paper-trader/market-regime", { cache: "no-store" }),
        fetch("/api/news-intelligence", { cache: "no-store" }),
      ]);

      const historyPayload = await historyResponse.json();
      const performancePayload = await performanceResponse.json();
      const memoryPayload = (await memoryResponse.json()) as AgentMemoryResponse;
      const learningPayload = (await learningResponse.json()) as AILearningResponse;
      const outcomesPayload = (await outcomesResponse.json()) as AIOutcomesResponse;
      const strategyPayload = (await strategyResponse.json()) as StrategyEvolutionResponse;
      const marketRegimePayload = (await marketRegimeResponse.json()) as MarketRegimeResponse;
      const newsIntelligencePayload = (await newsIntelligenceResponse.json()) as NewsIntelligenceResponse;

      setHistory(historyPayload.history ?? []);
      setPerformance(performancePayload.performance ?? null);
      setMemory(memoryPayload.memory ?? []);
      setLatestMemory(memoryPayload.latest ?? []);
      setMemoryStats(memoryPayload.stats ?? null);
      setLearning(learningPayload.learning ?? null);
      setOutcomes(outcomesPayload.outcomes ?? null);
      setStrategy(strategyPayload.strategy ?? null);
      setMarketRegime(marketRegimePayload.regime ?? null);
      setNewsIntelligence(newsIntelligencePayload.report ?? null);
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
          ? "AI Agent created a new paper trade, stored it in memory, and updated learning metrics."
          : "AI Agent completed review, stored the decision, and updated learning metrics."
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
  const executedMemories =
    memoryStats?.executedTrades ??
    memory.filter((item) => item.type === "AI_TRADE_EXECUTED").length;
  const rejectedMemories =
    memoryStats?.rejectedTrades ??
    memory.filter((item) => item.type === "AI_TRADE_REJECTED").length;

  return (
    <section className="bg-gray-900 border border-fuchsia-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-5xl font-black">🤖 AI Agent Control Center V11.0.1</h2>
          <p className="text-gray-400 text-xl mt-4 leading-relaxed">
            Kontrollzentrum für GPT Analyst, Claude Risk, Consensus Engine, Paper Trading, Memory, Learning, Outcomes, Market Regime, Strategy Selection und News Intelligence.
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
          subtitle={idea ? `${idea.symbol} · adaptive ${idea.confidence}%` : "Mock signal engine"}
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
          title="Learning Score"
          value={`${learning?.learningScore ?? 0}`}
          subtitle="Adaptive learning"
          accent="text-lime-400"
          border="border-lime-900"
        />
        <StatCard
          title="Memory"
          value={`${memoryStats?.totalMemories ?? memory.length}`}
          subtitle="Stored AI decisions"
          accent="text-fuchsia-400"
          border="border-fuchsia-900"
        />
      </div>

      <div className="bg-black border border-blue-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">📰 News Intelligence Panel V11.0.1</h3>
            <p className="text-gray-400 mt-2">
              Live News Foundation aus <span className="text-blue-400">/api/news-intelligence</span>. Später docken hier echte Geopolitik-, Makro- und Wirtschaftskalenderquellen an.
            </p>
          </div>

          <div className="bg-gray-950 border border-blue-800 rounded-xl p-4 min-w-[240px]">
            <p className="text-gray-400">Overall Sentiment</p>
            <p
              className={
                newsIntelligence?.overallSentiment === "RISK_OFF"
                  ? "text-red-400 text-3xl font-bold"
                  : newsIntelligence?.overallSentiment === "RISK_ON"
                    ? "text-green-400 text-3xl font-bold"
                    : "text-yellow-400 text-3xl font-bold"
              }
            >
              {newsIntelligence?.overallSentiment ?? "WAITING"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Total News"
            value={`${newsIntelligence?.totalNews ?? 0}`}
            subtitle="Tracked news items"
            accent="text-blue-400"
            border="border-blue-900"
          />
          <StatCard
            title="High Impact"
            value={`${newsIntelligence?.highImpactNews ?? 0}`}
            subtitle="High or critical events"
            accent="text-red-400"
            border="border-red-900"
          />
          <StatCard
            title="Geopolitical Risk"
            value={newsIntelligence?.geopoliticalRisk ?? "N/A"}
            subtitle="World risk layer"
            accent={
              newsIntelligence?.geopoliticalRisk === "HIGH" ||
              newsIntelligence?.geopoliticalRisk === "CRITICAL"
                ? "text-red-400"
                : newsIntelligence?.geopoliticalRisk === "MEDIUM"
                  ? "text-yellow-400"
                  : "text-green-400"
            }
            border={
              newsIntelligence?.geopoliticalRisk === "HIGH" ||
              newsIntelligence?.geopoliticalRisk === "CRITICAL"
                ? "border-red-900"
                : newsIntelligence?.geopoliticalRisk === "MEDIUM"
                  ? "border-yellow-900"
                  : "border-green-900"
            }
          />
          <StatCard
            title="Macro Risk"
            value={newsIntelligence?.macroRisk ?? "N/A"}
            subtitle="Central bank / macro layer"
            accent={
              newsIntelligence?.macroRisk === "HIGH" ||
              newsIntelligence?.macroRisk === "CRITICAL"
                ? "text-red-400"
                : newsIntelligence?.macroRisk === "MEDIUM"
                  ? "text-yellow-400"
                  : "text-green-400"
            }
            border={
              newsIntelligence?.macroRisk === "HIGH" ||
              newsIntelligence?.macroRisk === "CRITICAL"
                ? "border-red-900"
                : newsIntelligence?.macroRisk === "MEDIUM"
                  ? "border-yellow-900"
                  : "border-green-900"
            }
          />
          <StatCard
            title="Market Risk"
            value={`${newsIntelligence?.marketRiskScore ?? 0}`}
            subtitle="News impact score"
            accent={
              (newsIntelligence?.marketRiskScore ?? 0) >= 75
                ? "text-red-400"
                : (newsIntelligence?.marketRiskScore ?? 0) >= 45
                  ? "text-yellow-400"
                  : "text-green-400"
            }
            border={
              (newsIntelligence?.marketRiskScore ?? 0) >= 75
                ? "border-red-900"
                : (newsIntelligence?.marketRiskScore ?? 0) >= 45
                  ? "border-yellow-900"
                  : "border-green-900"
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-5 mb-6">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🌍 Affected Markets</h4>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {(newsIntelligence?.affectedMarkets ?? []).map((market) => (
                <div
                  key={market}
                  className="bg-black border border-blue-800 rounded-xl p-3"
                >
                  <p className="text-blue-300 font-bold">{market}</p>
                </div>
              ))}

              {(newsIntelligence?.affectedMarkets ?? []).length === 0 && (
                <p className="text-gray-500 col-span-2">No affected markets yet.</p>
              )}
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🧭 News Risk Logic</h4>
            <div className="space-y-3 mt-4">
              <StatusPill label="LOW" value="Normal trading" accent="text-green-400" />
              <StatusPill label="MEDIUM" value="Avoid overconfidence" accent="text-yellow-400" />
              <StatusPill label="HIGH" value="Reduce risk" accent="text-orange-400" />
              <StatusPill label="CRITICAL" value="Block / wait" accent="text-red-400" />
            </div>
          </div>

          <div className="bg-gray-950 border border-blue-900 rounded-2xl p-5">
            <h4 className="text-xl font-bold">💡 News Recommendation</h4>
            <p className="text-blue-300 font-bold mt-4 leading-relaxed">
              {newsIntelligence?.recommendation ?? "No news intelligence recommendation available yet."}
            </p>
            <p className="text-gray-500 mt-4 text-sm">
              Updated: {newsIntelligence?.updatedAt ?? "N/A"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {(newsIntelligence?.news ?? []).slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-xl font-bold">{item.category}</h4>
                <span
                  className={
                    item.impact === "CRITICAL" || item.impact === "HIGH"
                      ? "text-red-400 font-bold"
                      : item.impact === "MEDIUM"
                        ? "text-yellow-400 font-bold"
                        : "text-green-400 font-bold"
                  }
                >
                  {item.impact}
                </span>
              </div>

              <p className="text-blue-400 font-bold text-lg mt-4">{item.title}</p>
              <p className="text-gray-400 mt-3 leading-relaxed">{item.summary}</p>
              <p className="text-gray-500 mt-4 text-sm">
                {item.source} · {item.timestamp}
              </p>
            </div>
          ))}

          {(newsIntelligence?.news ?? []).length === 0 && (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-3">
              <p className="text-gray-500">No news intelligence items available yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-black border border-sky-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">🌍 Market Regime Panel V10.5.1</h3>
            <p className="text-gray-400 mt-2">
              Live Marktzustand aus <span className="text-sky-400">/api/ai-paper-trader/market-regime</span>.
            </p>
          </div>

          <div className="bg-gray-950 border border-sky-800 rounded-xl p-4 min-w-[240px]">
            <p className="text-gray-400">Current Regime</p>
            <p
              className={
                marketRegime?.regime === "TRENDING"
                  ? "text-green-400 text-3xl font-bold"
                  : marketRegime?.regime === "VOLATILE"
                    ? "text-orange-400 text-3xl font-bold"
                    : marketRegime?.regime === "NEWS"
                      ? "text-red-400 text-3xl font-bold"
                      : "text-yellow-400 text-3xl font-bold"
              }
            >
              {marketRegime?.regime ?? "WAITING"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Regime"
            value={marketRegime?.regime ?? "N/A"}
            subtitle="Current market state"
            accent={
              marketRegime?.regime === "TRENDING"
                ? "text-green-400"
                : marketRegime?.regime === "VOLATILE"
                  ? "text-orange-400"
                  : marketRegime?.regime === "NEWS"
                    ? "text-red-400"
                    : "text-yellow-400"
            }
            border={
              marketRegime?.regime === "TRENDING"
                ? "border-green-900"
                : marketRegime?.regime === "VOLATILE"
                  ? "border-orange-900"
                  : marketRegime?.regime === "NEWS"
                    ? "border-red-900"
                    : "border-yellow-900"
            }
          />
          <StatCard
            title="Regime Score"
            value={`${marketRegime?.score ?? 0}`}
            subtitle="Market regime confidence"
            accent="text-sky-400"
            border="border-sky-900"
          />
          <StatCard
            title="Memory Confidence"
            value={`${marketRegime?.memoryConfidence ?? 0}%`}
            subtitle="AI memory confidence"
            accent="text-fuchsia-400"
            border="border-fuchsia-900"
          />
          <StatCard
            title="Learning Score"
            value={`${marketRegime?.learningScore ?? 0}`}
            subtitle="Learning engine input"
            accent="text-lime-400"
            border="border-lime-900"
          />
          <StatCard
            title="Win Rate"
            value={`${marketRegime?.winRate ?? 0}%`}
            subtitle="Outcome input"
            accent="text-emerald-400"
            border="border-emerald-900"
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🧭 Regime Logic</h4>
            <div className="space-y-3 mt-4">
              <StatusPill label="TRENDING" value="Trend / Momentum" accent="text-green-400" />
              <StatusPill label="RANGING" value="Mean Reversion" accent="text-yellow-400" />
              <StatusPill label="VOLATILE" value="Breakout" accent="text-orange-400" />
              <StatusPill label="NEWS" value="Risk Reduction" accent="text-red-400" />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">📊 Regime Inputs</h4>
            <div className="space-y-3 mt-4">
              <StatusPill label="Total Memories" value={`${marketRegime?.totalMemories ?? 0}`} accent="text-fuchsia-400" />
              <StatusPill label="Learning Score" value={`${marketRegime?.learningScore ?? 0}`} accent="text-lime-400" />
              <StatusPill label="Memory Confidence" value={`${marketRegime?.memoryConfidence ?? 0}%`} accent="text-cyan-400" />
              <StatusPill label="Win Rate" value={`${marketRegime?.winRate ?? 0}%`} accent="text-emerald-400" />
            </div>
          </div>

          <div className="bg-gray-950 border border-sky-900 rounded-2xl p-5">
            <h4 className="text-xl font-bold">💡 Regime Recommendation</h4>
            <p className="text-sky-300 font-bold mt-4 leading-relaxed">
              {marketRegime?.recommendation ?? "No market regime recommendation available yet."}
            </p>
            <p className="text-gray-500 mt-4 text-sm">
              Updated: {marketRegime?.updatedAt ?? "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-black border border-indigo-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">🧭 Regime-Aware Strategy Panel V10.5.3</h3>
            <p className="text-gray-400 mt-2">
              Zeigt, welche Strategien zur aktuellen Market-Regime-Logik passen und welche Strategie aktiv bevorzugt wird.
            </p>
          </div>

          <div className="bg-gray-950 border border-indigo-800 rounded-xl p-4 min-w-[260px]">
            <p className="text-gray-400">Best Strategy for Regime</p>
            <p className="text-indigo-400 text-2xl font-bold">
              {strategy?.bestStrategy?.name ?? "Waiting"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Current Regime"
            value={strategy?.marketRegime?.regime ?? marketRegime?.regime ?? "N/A"}
            subtitle="Strategy selection context"
            accent="text-sky-400"
            border="border-sky-900"
          />
          <StatCard
            title="Best Strategy"
            value={strategy?.bestStrategy?.type ?? "N/A"}
            subtitle={strategy?.bestStrategy?.name ?? "No strategy selected"}
            accent="text-indigo-400"
            border="border-indigo-900"
          />
          <StatCard
            title="Regime Fit"
            value={strategy?.bestStrategy?.regimeFit ?? "N/A"}
            subtitle="Match against current regime"
            accent={
              strategy?.bestStrategy?.regimeFit?.startsWith("MATCH")
                ? "text-green-400"
                : "text-yellow-400"
            }
            border={
              strategy?.bestStrategy?.regimeFit?.startsWith("MATCH")
                ? "border-green-900"
                : "border-yellow-900"
            }
          />
          <StatCard
            title="Matched Strategies"
            value={`${strategy?.regimeMatchedStrategies?.length ?? 0}`}
            subtitle="Strategies fitting regime"
            accent="text-green-400"
            border="border-green-900"
          />
          <StatCard
            title="Selectable"
            value={`${strategy?.selectableStrategies ?? 0}`}
            subtitle="Universe candidates"
            accent="text-purple-400"
            border="border-purple-900"
          />
        </div>

        <div className="grid grid-cols-3 gap-5 mb-6">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🎯 Preferred Categories</h4>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {(strategy?.preferredCategories ?? []).map((category) => (
                <div
                  key={category}
                  className="bg-black border border-indigo-800 rounded-xl p-3"
                >
                  <p className="text-indigo-300 font-bold">{category}</p>
                </div>
              ))}

              {(strategy?.preferredCategories ?? []).length === 0 && (
                <p className="text-gray-500 col-span-2">No preferred categories available.</p>
              )}
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🏆 Selected Strategy Details</h4>
            <div className="space-y-3 mt-4">
              <StatusPill
                label="Score"
                value={`${strategy?.bestStrategy?.score ?? 0}`}
                accent="text-green-400"
              />
              <StatusPill
                label="Boost"
                value={`+${strategy?.bestStrategy?.confidenceBoost ?? 0}`}
                accent="text-cyan-400"
              />
              <StatusPill
                label="Risk"
                value={strategy?.bestStrategy?.riskLevel ?? "N/A"}
                accent="text-yellow-400"
              />
              <StatusPill
                label="Complexity"
                value={strategy?.bestStrategy?.complexity ?? "N/A"}
                accent="text-purple-400"
              />
            </div>
          </div>

          <div className="bg-gray-950 border border-indigo-900 rounded-2xl p-5">
            <h4 className="text-xl font-bold">💡 Regime Strategy Recommendation</h4>
            <p className="text-indigo-300 font-bold mt-4 leading-relaxed">
              {strategy?.recommendation ?? "No regime-aware strategy recommendation available yet."}
            </p>
            <p className="text-gray-500 mt-4 text-sm">
              Updated: {strategy?.updatedAt ?? "N/A"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-5">
          {(strategy?.regimeMatchedStrategies ?? []).slice(0, 4).map((item, index) => (
            <div
              key={item.id}
              className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-xl font-bold">Match #{index + 1}</h4>
                <span className="text-green-400 font-bold">
                  {item.regimeFit ?? "MATCH"}
                </span>
              </div>
              <p className="text-indigo-400 font-bold text-xl mt-4">{item.name}</p>
              <p className="text-gray-400 mt-2">{item.type}</p>
              <p className="text-4xl font-black text-white mt-4">{item.score}</p>
              <p className="text-gray-500 mt-2">
                Base {item.baseScore} · Boost +{item.confidenceBoost}
              </p>
            </div>
          ))}

          {(strategy?.regimeMatchedStrategies ?? []).length === 0 && (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-4">
              <p className="text-gray-500">No regime-matched strategies available yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-black border border-lime-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">🧠 AI Learning Panel V10.3.5</h3>
            <p className="text-gray-400 mt-2">
              Live Analyse aus <span className="text-lime-400">/api/ai-paper-trader/learning</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="bg-lime-950 border border-lime-800 rounded-xl px-5 py-3 font-bold text-lime-300 hover:bg-lime-900 transition disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Learning"}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Learning Score"
            value={`${learning?.learningScore ?? 0}`}
            subtitle="Overall learning health"
            accent="text-lime-400"
            border="border-lime-900"
          />
          <StatCard
            title="Agent Accuracy"
            value={`${learning?.agentAccuracy ?? 0}%`}
            subtitle="Decision quality"
            accent="text-green-400"
            border="border-green-900"
          />
          <StatCard
            title="Recommended Conf."
            value={`${learning?.recommendedConfidence ?? 0}%`}
            subtitle="Next confidence target"
            accent="text-cyan-400"
            border="border-cyan-900"
          />
          <StatCard
            title="Execution Rate"
            value={`${learning?.executionRate ?? 0}%`}
            subtitle="Approved actions"
            accent="text-blue-400"
            border="border-blue-900"
          />
          <StatCard
            title="Rejection Rate"
            value={`${learning?.rejectionRate ?? 0}%`}
            subtitle="Blocked decisions"
            accent="text-red-400"
            border="border-red-900"
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">📊 Learning Metrics</h4>
            <div className="space-y-3 mt-4">
              <StatusPill
                label="Avg Confidence"
                value={`${learning?.averageConfidence ?? 0}%`}
                accent="text-cyan-400"
              />
              <StatusPill
                label="Avg Consensus"
                value={`${learning?.averageConsensus ?? 0}`}
                accent="text-purple-400"
              />
              <StatusPill
                label="Avg Risk Score"
                value={`${learning?.averageRiskScore ?? 0}`}
                accent="text-yellow-400"
              />
              <StatusPill
                label="Confidence Gap"
                value={`${learning?.confidenceGap ?? 0}`}
                accent="text-orange-400"
              />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🧬 Learning State</h4>
            <div className="space-y-3 mt-4">
              <StatusPill
                label="Total Memories"
                value={`${learning?.totalMemories ?? 0}`}
                accent="text-fuchsia-400"
              />
              <StatusPill
                label="Executed"
                value={`${learning?.executedTrades ?? 0}`}
                accent="text-green-400"
              />
              <StatusPill
                label="Rejected"
                value={`${learning?.rejectedTrades ?? 0}`}
                accent="text-red-400"
              />
              <StatusPill
                label="Status"
                value={learning?.status ?? "waiting"}
                accent="text-lime-400"
              />
            </div>
          </div>

          <div className="bg-gray-950 border border-lime-900 rounded-2xl p-5">
            <h4 className="text-xl font-bold">💡 Recommendation</h4>
            <p className="text-lime-300 font-bold mt-4 leading-relaxed">
              {learning?.recommendation ?? "No learning recommendation available yet."}
            </p>
            <p className="text-gray-500 mt-4 text-sm">
              Updated: {learning?.updatedAt ?? "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-black border border-orange-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">🧬 Strategy Evolution Panel V10.4.1</h3>
            <p className="text-gray-400 mt-2">
              Live Strategie-Ranking aus <span className="text-orange-400">/api/ai-paper-trader/strategy</span>.
            </p>
          </div>

          <div className="bg-gray-950 border border-orange-800 rounded-xl p-4 min-w-[240px]">
            <p className="text-gray-400">Best Strategy</p>
            <p className="text-orange-400 text-2xl font-bold">
              {strategy?.bestStrategy?.name ?? "Waiting"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Best Strategy"
            value={strategy?.bestStrategy?.type ?? "N/A"}
            subtitle={strategy?.bestStrategy?.name ?? "No strategy selected"}
            accent="text-orange-400"
            border="border-orange-900"
          />
          <StatCard
            title="Best Score"
            value={`${strategy?.bestStrategy?.score ?? 0}`}
            subtitle="Highest ranked strategy"
            accent="text-green-400"
            border="border-green-900"
          />
          <StatCard
            title="Confidence Boost"
            value={`+${strategy?.bestStrategy?.confidenceBoost ?? 0}`}
            subtitle="Suggested boost"
            accent="text-cyan-400"
            border="border-cyan-900"
          />
          <StatCard
            title="Adaptive Factor"
            value={`${strategy?.adaptiveFactor ?? 0}`}
            subtitle="Memory + learning + outcomes"
            accent="text-purple-400"
            border="border-purple-900"
          />
          <StatCard
            title="Strategy Status"
            value={strategy?.bestStrategy?.status ?? "N/A"}
            subtitle="Current priority"
            accent={
              strategy?.bestStrategy?.status === "ACTIVE"
                ? "text-green-400"
                : "text-yellow-400"
            }
            border={
              strategy?.bestStrategy?.status === "ACTIVE"
                ? "border-green-900"
                : "border-yellow-900"
            }
          />
        </div>

        <div className="grid grid-cols-4 gap-5 mb-6">
          {(strategy?.strategies ?? []).map((item, index) => (
            <div
              key={item.id}
              className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-xl font-bold">#{index + 1}</h4>
                <span
                  className={
                    item.status === "ACTIVE"
                      ? "text-green-400 font-bold"
                      : item.status === "REVIEW"
                        ? "text-red-400 font-bold"
                        : "text-yellow-400 font-bold"
                  }
                >
                  {item.status}
                </span>
              </div>

              <p className="text-orange-400 font-bold text-xl mt-4">
                {item.name}
              </p>
              <p className="text-gray-400 mt-2">{item.type}</p>
              <p className="text-4xl font-black text-white mt-4">
                {item.score}
              </p>
              <p className="text-gray-500 mt-2">
                Base {item.baseScore} · Boost +{item.confidenceBoost}
              </p>
              <p className="text-gray-500 text-sm mt-4 leading-relaxed">
                {item.reason}
              </p>
            </div>
          ))}

          {(strategy?.strategies ?? []).length === 0 && (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-4">
              <p className="text-gray-500">No strategy ranking available yet.</p>
            </div>
          )}
        </div>

        <div className="bg-gray-950 border border-orange-900 rounded-2xl p-5">
          <h4 className="text-xl font-bold">💡 Strategy Recommendation</h4>
          <p className="text-orange-300 font-bold mt-4 leading-relaxed">
            {strategy?.recommendation ?? "No strategy recommendation available yet."}
          </p>
          <p className="text-gray-500 mt-4 text-sm">
            Updated: {strategy?.updatedAt ?? "N/A"}
          </p>
        </div>
      </div>

      <div className="bg-black border border-emerald-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">🏁 AI Trade Outcome Panel V10.3.9</h3>
            <p className="text-gray-400 mt-2">
              Live Outcome Analyse aus <span className="text-emerald-400">/api/ai-paper-trader/outcomes</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="bg-emerald-950 border border-emerald-800 rounded-xl px-5 py-3 font-bold text-emerald-300 hover:bg-emerald-900 transition disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Outcomes"}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Wins"
            value={`${outcomes?.wins ?? 0}`}
            subtitle="Positive outcome updates"
            accent="text-green-400"
            border="border-green-900"
          />
          <StatCard
            title="Losses"
            value={`${outcomes?.losses ?? 0}`}
            subtitle="Negative outcome updates"
            accent="text-red-400"
            border="border-red-900"
          />
          <StatCard
            title="Win Rate"
            value={`${outcomes?.winRate ?? 0}%`}
            subtitle="Outcome win rate"
            accent="text-emerald-400"
            border="border-emerald-900"
          />
          <StatCard
            title="Total PnL"
            value={`${outcomes?.totalUnrealizedPnL ?? 0}`}
            subtitle="Tracked unrealized P/L"
            accent={(outcomes?.totalUnrealizedPnL ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
            border={(outcomes?.totalUnrealizedPnL ?? 0) >= 0 ? "border-green-900" : "border-red-900"}
          />
          <StatCard
            title="Outcome Quality"
            value={`${outcomes?.outcomeQuality ?? 0}`}
            subtitle="Outcome score"
            accent="text-cyan-400"
            border="border-cyan-900"
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">📊 Outcome Metrics</h4>
            <div className="space-y-3 mt-4">
              <StatusPill
                label="Executed Trades"
                value={`${outcomes?.executedTrades ?? 0}`}
                accent="text-green-400"
              />
              <StatusPill
                label="Rejected Trades"
                value={`${outcomes?.rejectedTrades ?? 0}`}
                accent="text-red-400"
              />
              <StatusPill
                label="Position Updates"
                value={`${outcomes?.positionUpdates ?? 0}`}
                accent="text-blue-400"
              />
              <StatusPill
                label="Average PnL"
                value={`${outcomes?.averagePnL ?? 0}`}
                accent={(outcomes?.averagePnL ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
              />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🧾 Latest Outcome Events</h4>
            <div className="space-y-3 mt-4">
              {(outcomes?.latestOutcomeEvents ?? []).slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="bg-black border border-gray-800 rounded-xl p-3"
                >
                  <p className="text-emerald-400 font-bold">{event.type}</p>
                  <p className="text-gray-500 text-sm mt-1">{event.timestamp}</p>
                </div>
              ))}

              {(outcomes?.latestOutcomeEvents ?? []).length === 0 && (
                <p className="text-gray-500">No outcome events yet. Use Market Update to generate PnL updates.</p>
              )}
            </div>
          </div>

          <div className="bg-gray-950 border border-emerald-900 rounded-2xl p-5">
            <h4 className="text-xl font-bold">💡 Outcome Recommendation</h4>
            <p className="text-emerald-300 font-bold mt-4 leading-relaxed">
              {outcomes?.recommendation ?? "No outcome recommendation available yet."}
            </p>
            <p className="text-gray-500 mt-4 text-sm">
              Updated: {outcomes?.updatedAt ?? "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-black border border-cyan-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">🎛 Adaptive Confidence Badge V10.3.7</h3>
            <p className="text-gray-400 mt-2">
              Zeigt, ob der GPT Analyst bereits die Empfehlung der Learning Engine für neue Trades verwendet.
            </p>
          </div>

          <div className="bg-gray-950 border border-cyan-800 rounded-xl p-4 min-w-[220px]">
            <p className="text-gray-400">Adaptive Status</p>
            <p
              className={
                idea?.adaptiveConfidenceApplied
                  ? "text-green-400 text-2xl font-bold"
                  : "text-yellow-400 text-2xl font-bold"
              }
            >
              {idea?.adaptiveConfidenceApplied ? "Applied" : "Waiting"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Base Confidence"
            value={`${idea?.baseConfidence ?? 82}%`}
            subtitle="Original GPT score"
            accent="text-blue-400"
            border="border-blue-900"
          />
          <StatCard
            title="Adaptive Confidence"
            value={`${idea?.confidence ?? learning?.recommendedConfidence ?? 0}%`}
            subtitle="Used for next decision"
            accent="text-cyan-400"
            border="border-cyan-900"
          />
          <StatCard
            title="Adaptive Applied"
            value={idea?.adaptiveConfidenceApplied ? "Yes" : "No"}
            subtitle="Learning feedback used"
            accent={idea?.adaptiveConfidenceApplied ? "text-green-400" : "text-yellow-400"}
            border={idea?.adaptiveConfidenceApplied ? "border-green-900" : "border-yellow-900"}
          />
          <StatCard
            title="Recommended"
            value={`${learning?.recommendedConfidence ?? 0}%`}
            subtitle="Learning engine target"
            accent="text-lime-400"
            border="border-lime-900"
          />
          <StatCard
            title="Confidence Gap"
            value={`${learning?.confidenceGap ?? 0}`}
            subtitle="Confidence vs consensus"
            accent="text-orange-400"
            border="border-orange-900"
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🧠 Learning Feedback</h4>
            <p className="text-gray-400 mt-4 leading-relaxed">
              {learning?.recommendation ?? "No learning recommendation available yet."}
            </p>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">📈 Confidence Movement</h4>
            <div className="space-y-3 mt-4">
              <StatusPill
                label="Base"
                value={`${idea?.baseConfidence ?? 82}%`}
                accent="text-blue-400"
              />
              <StatusPill
                label="Current"
                value={`${idea?.confidence ?? 0}%`}
                accent="text-cyan-400"
              />
              <StatusPill
                label="Delta"
                value={`${(idea?.confidence ?? 0) - (idea?.baseConfidence ?? 82)}`}
                accent={
                  ((idea?.confidence ?? 0) - (idea?.baseConfidence ?? 82)) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }
              />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5">
            <h4 className="text-xl font-bold">🔒 Safety Note</h4>
            <p className="text-gray-400 mt-4 leading-relaxed">
              Adaptive Confidence verändert nur Paper-Trading-Entscheidungen. Live Execution bleibt weiterhin blockiert.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-black border border-fuchsia-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">🧠 AI Agent Memory Panel</h3>
            <p className="text-gray-400 mt-2">
              Live Memory Layer aus <span className="text-fuchsia-400">/api/ai-paper-trader/memory</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="bg-fuchsia-950 border border-fuchsia-800 rounded-xl px-5 py-3 font-bold text-fuchsia-300 hover:bg-fuchsia-900 transition disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh Memory"}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-5 mb-6">
          <StatCard
            title="Total Memories"
            value={`${memoryStats?.totalMemories ?? memory.length}`}
            subtitle="All stored decisions"
            accent="text-fuchsia-400"
            border="border-fuchsia-900"
          />
          <StatCard
            title="Executed"
            value={`${executedMemories}`}
            subtitle="AI paper trades"
            accent="text-green-400"
            border="border-green-900"
          />
          <StatCard
            title="Rejected"
            value={`${rejectedMemories}`}
            subtitle="Blocked decisions"
            accent="text-red-400"
            border="border-red-900"
          />
          <StatCard
            title="Avg Confidence"
            value={`${memoryStats?.averageConfidence ?? 0}%`}
            subtitle="GPT idea score"
            accent="text-cyan-400"
            border="border-cyan-900"
          />
          <StatCard
            title="Avg Consensus"
            value={`${memoryStats?.averageConsensus ?? 0}`}
            subtitle="Consensus score"
            accent="text-purple-400"
            border="border-purple-900"
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          {latestMemory.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="bg-gray-950 border border-gray-800 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-xl font-bold">{item.symbol ?? "SYSTEM"}</h4>
                <span
                  className={
                    item.executed
                      ? "text-green-400 font-bold"
                      : "text-red-400 font-bold"
                  }
                >
                  {item.executed ? "EXECUTED" : "REJECTED"}
                </span>
              </div>

              <p className="text-gray-400 mt-3">
                {item.direction ?? "N/A"} · Confidence {item.confidence ?? 0}%
              </p>
              <p className="text-gray-500 mt-2">
                Consensus {item.consensusScore ?? 0} · Risk {item.riskScore ?? 0}
              </p>
              <p className="text-gray-500 mt-3 text-sm">{item.createdAt}</p>
            </div>
          ))}

          {latestMemory.length === 0 && (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 col-span-3">
              <p className="text-gray-500">No AI memory stored yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-3xl font-bold mb-5">🚀 Run AI Agent</h3>
          <p className="text-gray-400 leading-relaxed mb-6">
            Startet einen vollständigen Mock-Agent-Zyklus: GPT Trade Idea → Claude Risk → Consensus → Paper Order → Memory → Learning.
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
              <p className="text-gray-400">Base Confidence: {idea.baseConfidence ?? 82}%</p>
              <p className="text-gray-400">Adaptive Confidence: {idea.confidence}%</p>
              <p className={idea.adaptiveConfidenceApplied ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>
                Adaptive Applied: {idea.adaptiveConfidenceApplied ? "Yes" : "No"}
              </p>
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